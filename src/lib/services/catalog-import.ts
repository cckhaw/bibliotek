import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { Tx } from "../db";
import { audit } from "../audit";
import { capErrors, clean, normaliseIsbn, parseCsv, splitList, type RowError } from "../csv";
import { assertCapacity } from "./licensing";

/**
 * Columns (case/spacing-insensitive):
 *   title*, author*, category*, isbn, publisher, dewey_code, lc_code, genre, subject, tags (a;b;c),
 *   description, copies (default 1), barcode (only when copies=1; generated otherwise), branch_code*
 */
const ALIASES: Record<string, string> = {
  dewey: "dewey_code", dewey_decimal: "dewey_code", ddc: "dewey_code", lcc: "lc_code", loc_code: "lc_code",
  branch: "branch_code", location: "branch_code", qty: "copies", quantity: "copies", isbn13: "isbn", isbn10: "isbn",
};

const rowSchema = z.object({
  title: z.string().min(1, "title is required").max(500),
  author: z.string().min(1, "author is required").max(300),
  category: z.string().min(1, "category is required").max(120),
  isbn: z.string().optional(),
  publisher: z.string().max(300).optional(),
  dewey_code: z.string().regex(/^\d{3}(\.\d+)?$/, "dewey_code must look like 005 or 005.133").optional(),
  lc_code: z.string().max(60).optional(),
  genre: z.string().max(120).optional(),
  subject: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  copies: z.coerce.number().int("copies must be a whole number").min(1).max(100).default(1),
  barcode: z.string().min(3, "barcode must be at least 3 characters").max(64).regex(/^[A-Za-z0-9._\-]+$/, "barcode may only contain letters, digits, . _ -").optional(),
  branch_code: z.string().min(1, "branch_code is required"),
});

const newBarcode = () => `BK${randomBytes(5).toString("hex").toUpperCase()}`;
const itemKey = (title: string, author: string) => `${title.trim().toLowerCase()}|${author.trim().toLowerCase()}`;
const chunk = <T>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export interface CatalogImportResult {
  dryRun: boolean;
  totalRows: number;
  validRows: number;
  newItems: number;
  newCopies: number;
  errors: RowError[];
  errorCount: number;
  truncated: boolean;
}

export async function importCatalog(
  tx: Tx,
  a: { tenantId: string; actorId: string; csv: string; dryRun?: boolean; ip?: string | null },
): Promise<CatalogImportResult> {
  const { rows, structuralErrors } = parseCsv(a.csv, { required: ["title", "author", "category", "branch_code"], aliases: ALIASES });
  const errors: RowError[] = [...structuralErrors];
  const badLines = new Set(structuralErrors.map((e) => e.line));

  const branches = new Map((await tx.branch.findMany({ select: { id: true, code: true } })).map((b) => [b.code.toLowerCase(), b.id]));

  // 1. Row-level validation
  type Valid = z.infer<typeof rowSchema> & { line: number; isbnNorm?: string; branchId: string; tags: string[] };
  const valid: Valid[] = [];
  for (const { line, record } of rows) {
    if (badLines.has(line)) continue;
    const cleaned = Object.fromEntries(Object.entries(record).map(([k, v]) => [k, clean(v as string)]));
    const p = rowSchema.safeParse(cleaned);
    if (!p.success) {
      for (const i of p.error.issues) errors.push({ line, field: String(i.path[0] ?? ""), message: i.message });
      continue;
    }
    const d = p.data;
    let isbnNorm: string | undefined;
    if (d.isbn) {
      const n = normaliseIsbn(d.isbn);
      if (!n) { errors.push({ line, field: "isbn", message: `"${d.isbn}" is not a valid ISBN-10/13 (check digit failed)` }); continue; }
      isbnNorm = n;
    }
    if (d.barcode && d.copies > 1) { errors.push({ line, field: "barcode", message: "barcode can only be supplied when copies = 1" }); continue; }
    const branchId = branches.get(d.branch_code.toLowerCase());
    if (!branchId) { errors.push({ line, field: "branch_code", message: `unknown branch "${d.branch_code}"` }); continue; }
    valid.push({ ...d, line, isbnNorm, branchId, tags: splitList(clean(record.tags)) });
  }

  // 2. Barcode uniqueness: within the file and against existing copies
  const seen = new Map<string, number>();
  const supplied = valid.filter((v) => v.barcode).map((v) => v.barcode!);
  const existingBarcodes = new Set(
    supplied.length ? (await tx.bookCopy.findMany({ where: { barcode: { in: supplied } }, select: { barcode: true } })).map((c) => c.barcode) : [],
  );
  const accepted: Valid[] = [];
  for (const v of valid) {
    if (v.barcode) {
      if (existingBarcodes.has(v.barcode)) { errors.push({ line: v.line, field: "barcode", message: `barcode "${v.barcode}" already exists` }); continue; }
      const first = seen.get(v.barcode);
      if (first) { errors.push({ line: v.line, field: "barcode", message: `barcode "${v.barcode}" duplicates line ${first}` }); continue; }
      seen.set(v.barcode, v.line);
    }
    accepted.push(v);
  }

  // 3. Match rows to catalog items (ISBN first, else title+author), creating items for the rest
  const existing = await tx.catalogItem.findMany({ select: { id: true, isbn: true, title: true, author: true } });
  const byIsbn = new Map(existing.filter((e) => e.isbn).map((e) => [e.isbn!, e.id]));
  const byTitle = new Map(existing.map((e) => [itemKey(e.title, e.author), e.id]));

  const newItems: Prisma.CatalogItemCreateManyInput[] = [];
  const copyRows: { id: string; tenantId: string; catalogItemId: string; barcode: string; homeBranchId: string; currentBranchId: string }[] = [];

  for (const v of accepted) {
    let itemId = (v.isbnNorm && byIsbn.get(v.isbnNorm)) || byTitle.get(itemKey(v.title, v.author));
    if (!itemId) {
      itemId = randomUUID();
      newItems.push({
        id: itemId, tenantId: a.tenantId, isbn: v.isbnNorm ?? null, title: v.title, author: v.author, category: v.category,
        publisher: v.publisher, deweyCode: v.dewey_code, lcCode: v.lc_code, genre: v.genre, subject: v.subject,
        description: v.description, tags: v.tags,
      });
      if (v.isbnNorm) byIsbn.set(v.isbnNorm, itemId);
      byTitle.set(itemKey(v.title, v.author), itemId);
    }
    for (let i = 0; i < v.copies; i++) {
      copyRows.push({
        id: randomUUID(), tenantId: a.tenantId, catalogItemId: itemId,
        barcode: v.barcode ?? newBarcode(), homeBranchId: v.branchId, currentBranchId: v.branchId,
      });
    }
  }

  const result: CatalogImportResult = {
    dryRun: !!a.dryRun, totalRows: rows.length, validRows: accepted.length,
    newItems: newItems.length, newCopies: copyRows.length, ...capErrors(errors.sort((x, y) => x.line - y.line)),
  };
  if (a.dryRun || copyRows.length === 0) return result;

  // 4. License check + persist (single transaction: all valid rows land, or none do)
  await assertCapacity(tx, a.tenantId, { books: copyRows.length });
  for (const part of chunk(newItems, 1000)) await tx.catalogItem.createMany({ data: part });
  for (const part of chunk(copyRows, 1000)) await tx.bookCopy.createMany({ data: part });

  await audit(tx, {
    tenantId: a.tenantId, userId: a.actorId, ip: a.ip, action: "BOOK_IMPORTED",
    details: { newItems: newItems.length, newCopies: copyRows.length, rejectedRows: errors.length },
  });
  return result;
}
