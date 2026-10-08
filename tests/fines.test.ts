import { describe, expect, it } from "vitest";
import { chargeableDays, computeFineCents } from "@/lib/services/fines";
import { dueDateFrom } from "@/lib/services/policy";

const d = (s: string) => new Date(s);

describe("chargeableDays", () => {
  const due = d("2026-03-14T23:59:59.999Z");
  it("is zero before and on the due date", () => {
    expect(chargeableDays(due, d("2026-03-10T00:00:00Z"), 1)).toBe(0);
    expect(chargeableDays(due, due, 0)).toBe(0);
  });
  it("applies the grace period", () => {
    // Any part of a day late counts as a full day late; grace is then subtracted.
    expect(chargeableDays(due, d("2026-03-15T00:00:00Z"), 1)).toBe(0); // 1ms late  -> 1 day late -> free
    expect(chargeableDays(due, d("2026-03-15T23:59:59Z"), 1)).toBe(0); // <24h late -> 1 day late -> free
    expect(chargeableDays(due, d("2026-03-16T01:00:00Z"), 1)).toBe(1); // 25h late  -> 2 days late -> 1 chargeable
  });
  it("never goes negative with a huge grace period", () => {
    expect(chargeableDays(due, d("2026-03-20T00:00:00Z"), 30)).toBe(0);
  });
});

describe("computeFineCents", () => {
  const base = { dueDate: d("2026-03-14T23:59:59.999Z"), dailyCents: 50, graceDays: 1 };
  it("multiplies chargeable days by the daily rate in integer cents", () => {
    expect(computeFineCents({ ...base, asOf: d("2026-03-24T12:00:00Z") })).toEqual({ days: 9, cents: 450 });
  });
  it("respects the per-loan cap", () => {
    expect(computeFineCents({ ...base, asOf: d("2026-03-24T12:00:00Z"), capCents: 300 }).cents).toBe(300);
  });
  it("charges nothing inside the grace window", () => {
    expect(computeFineCents({ ...base, asOf: d("2026-03-15T10:00:00Z") })).toEqual({ days: 0, cents: 0 });
  });
  it("avoids float drift (0.10/day over 3 days = 30 cents)", () => {
    expect(computeFineCents({ dueDate: d("2026-03-01T00:00:00Z"), asOf: d("2026-03-04T00:00:00Z"), dailyCents: 10, graceDays: 0 }).cents).toBe(30);
  });
});

describe("dueDateFrom", () => {
  it("lands at the end of the due day (UTC)", () => {
    expect(dueDateFrom(d("2026-03-01T09:15:00Z"), 14).toISOString()).toBe("2026-03-15T23:59:59.999Z");
  });
});
