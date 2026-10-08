import Papa from "papaparse";
import { AppError } from "./errors";

export interface RowError {
  /** Spreadsheet line number (header = line 1) so users can jump straight to the row. */
  line: number;
  field?: string;
  message: string;
}

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 50_000;

const normaliseHeader = (h: string) =>
  h.replace(/^﻿/, "").trim().toLowerCase().replace(/[\s\-/]+/g, "_");

/**
 * Parse a CSV into header-keyed records. Structural problems (ragged rows, unterminated quotes) are returned
 * as RowErrors instead of throwing, so the import can report them alongside validation errors.
 * `aliases` maps accepted alternative header names onto the canonical ones.
 */
export function parseCsv(text: string, opts: { required: string[]; aliases?: Record<string, string> }) {
  if (Buffer.byteLength(text) > MAX_CSV_BYTES) throw new AppError("CSV_TOO_LARGE", `CSV exceeds ${MAX_CSV_BYTES / 1024 / 1024} MB`, 413);

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => {
      const n = normaliseHeader(h);
      return opts.aliases?.[n] ?? n;
    },
  });

  const headers = parsed.meta.fields ?? [];
  const missing = opts.required.filter((h) => !headers.includes(h));
  if (missing.length) {
    throw new AppError("CSV_HEADERS", `Missing required column(s): ${missing.join(", ")}. Found: ${headers.join(", ") || "(none)"}`, 400);
  }
  if (parsed.data.length > MAX_CSV_ROWS) throw new AppError("CSV_TOO_MANY_ROWS", `CSV has more than ${MAX_CSV_ROWS} rows`, 413);

  const structural = new Map<number, RowError>();
  for (const e of parsed.errors) {
    if (e.row == null) continue;
    const line = e.row + 2;
    if (!structural.has(line)) structural.set(line, { line, message: e.message });
  }
  const rows = parsed.data.map((record, i) => ({ line: i + 2, record }));
  return { rows, structuralErrors: [...structural.values()] };
}

export const clean = (v: string | undefined) => {
  const t = v?.trim();
  return t ? t : undefined;
};

/** Validate an ISBN-10 or ISBN-13 including check digit. Returns the normalised digits or null. */
export function normaliseIsbn(raw: string): string | null {
  const s = raw.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{13}$/.test(s)) {
    const sum = [...s].slice(0, 12).reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0);
    return (10 - (sum % 10)) % 10 === Number(s[12]) ? s : null;
  }
  if (/^\d{9}[\dX]$/.test(s)) {
    const sum = [...s].reduce((a, c, i) => a + (c === "X" ? 10 : Number(c)) * (10 - i), 0);
    return sum % 11 === 0 ? s : null;
  }
  return null;
}

export const splitList = (v: string | undefined) =>
  (v ?? "").split(/[;|]/).map((t) => t.trim()).filter(Boolean);

/** Cap the report we send back; the true count is returned separately. */
export const capErrors = (errors: RowError[], max = 500) => ({ errors: errors.slice(0, max), errorCount: errors.length, truncated: errors.length > max });
