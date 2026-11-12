import { describe, expect, it } from "vitest";
import {
  calendarMonthOf,
  latestCompleteMonth,
  monthFromIndex,
  monthIndex,
  monthRange,
  yearOf,
} from "@/lib/months";

describe("month helpers", () => {
  it("round-trips months and indexes", () => {
    expect(monthFromIndex(monthIndex("2012-02"))).toBe("2012-02");
    expect(monthIndex("2001-01") - monthIndex("2000-12")).toBe(1);
    expect(() => monthIndex("2020-13")).toThrow();
  });

  it("ranges are inclusive", () => {
    expect(monthRange("2000-11", "2001-02")).toEqual(["2000-11", "2000-12", "2001-01", "2001-02"]);
    expect(monthRange("2000-11", "2026-11")).toHaveLength(313);
  });

  it("year and calendar month", () => {
    expect(yearOf("2024-03")).toBe(2024);
    expect(calendarMonthOf("2024-03")).toBe(3);
  });

  it("latest complete month", () => {
    expect(latestCompleteMonth("2026-11-11")).toBe("2026-10"); // November only partly covered
    expect(latestCompleteMonth("2026-10-31")).toBe("2026-10");
    expect(latestCompleteMonth("2024-02-29")).toBe("2024-02"); // leap year
    expect(latestCompleteMonth("2026-01-15")).toBe("2025-12");
  });
});
