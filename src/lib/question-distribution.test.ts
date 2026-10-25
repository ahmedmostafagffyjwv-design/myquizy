import { describe, expect, it } from "vitest";
import { distributionCounts } from "./question-distribution";

describe("distributionCounts", () => {
  it("uses the 80/15/5 cognitive split", () => {
    const d = distributionCounts(10);
    expect(d).toEqual({ analytical: 8, comprehension: 2, direct: 0 });
  });

  it("keeps analytical dominant and sums to the requested total", () => {
    for (const n of [3, 5, 7, 12, 20, 25]) {
      const d = distributionCounts(n);
      expect(d.analytical + d.comprehension + d.direct).toBe(n);
      expect(d.analytical).toBeGreaterThanOrEqual(d.comprehension);
      expect(d.analytical).toBeGreaterThanOrEqual(d.direct);
      expect(Math.min(d.analytical, d.comprehension, d.direct)).toBeGreaterThanOrEqual(0);
    }
  });
});
