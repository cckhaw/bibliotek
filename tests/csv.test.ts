import { describe, expect, it } from "vitest";
import { normaliseIsbn, parseCsv, splitList } from "@/lib/csv";

describe("normaliseIsbn", () => {
  it("accepts valid ISBN-13 and ISBN-10 (with hyphens)", () => {
    expect(normaliseIsbn("978-0-13-468599-1")).toBe("9780134685991");
    expect(normaliseIsbn("0-306-40615-2")).toBe("0306406152");
    expect(normaliseIsbn("080442957X")).toBe("080442957X");
  });
  it("rejects bad check digits and garbage", () => {
    expect(normaliseIsbn("9780134685992")).toBeNull();
    expect(normaliseIsbn("0306406153")).toBeNull();
    expect(normaliseIsbn("abc")).toBeNull();
  });
});

describe("parseCsv", () => {
  it("normalises headers, applies aliases, strips BOM and reports spreadsheet line numbers", () => {
    const csv = "﻿Title, Author ,Category,Branch\nA,B,C,MAIN\nD,E,F,SCI\n";
    const { rows } = parseCsv(csv, { required: ["title", "author", "category", "branch_code"], aliases: { branch: "branch_code" } });
    expect(rows.map((r) => r.line)).toEqual([2, 3]);
    expect(rows[1].record).toMatchObject({ title: "D", author: "E", branch_code: "SCI" });
  });
  it("throws a helpful error when required columns are missing", () => {
    expect(() => parseCsv("title,author\nA,B\n", { required: ["title", "isbn"] })).toThrow(/Missing required column\(s\): isbn/);
  });
  it("reports ragged rows as structural errors instead of throwing", () => {
    const { structuralErrors } = parseCsv("a,b,c\n1,2,3\n1,2\n", { required: ["a"] });
    expect(structuralErrors.map((e) => e.line)).toEqual([3]);
  });
  it("handles quoted commas and skips blank lines", () => {
    const { rows } = parseCsv('t,a\n"Hello, World",X\n\n', { required: ["t"] });
    expect(rows).toHaveLength(1);
    expect(rows[0].record.t).toBe("Hello, World");
  });
});

describe("splitList", () => {
  it("splits on ; and |", () => expect(splitList("a; b|c;;")).toEqual(["a", "b", "c"]));
});
