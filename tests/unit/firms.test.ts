import { describe, expect, it } from "vitest";
import {
  ALGORITHM_REFERENCES,
  bboxText,
  csvNoteLines,
  FIRMS_ACKNOWLEDGEMENT,
  FIRMS_URLS,
} from "@/lib/firms";

describe("FIRMS acknowledgement and references", () => {
  it("uses the FIRMS-requested acknowledgement wording", () => {
    expect(FIRMS_ACKNOWLEDGEMENT).toMatch(
      /^We acknowledge the use of data and\/or imagery from NASA's Fire Information for Resource Management System \(FIRMS\)/,
    );
  });

  it("cites the MODIS C6 and VIIRS 375 m algorithm papers by DOI", () => {
    const dois = ALGORITHM_REFERENCES.map((r) => r.doi);
    expect(dois).toContain("10.1016/j.rse.2016.02.054");
    expect(dois).toContain("10.1016/j.rse.2013.12.008");
  });

  it("links only to https NASA pages", () => {
    for (const url of Object.values(FIRMS_URLS)) {
      expect(url).toMatch(
        /^https:\/\/(www\.earthdata\.nasa\.gov|firms\.modaps\.eosdis\.nasa\.gov)\//,
      );
    }
  });
});

describe("csvNoteLines", () => {
  it("returns comment lines with the acknowledgement first and no commas-only junk", () => {
    const lines = csvNoteLines();
    expect(lines.length).toBeGreaterThan(3);
    expect(lines.every((l) => l.startsWith("# "))).toBe(true);
    expect(lines[0]).toContain("(FIRMS)");
    expect(lines.some((l) => l.includes("UTC"))).toBe(true);
    expect(lines.every((l) => !l.includes("\n"))).toBe(true);
  });
});

describe("bboxText", () => {
  it("formats west,south,east,north rounded to 2 decimals", () => {
    expect(bboxText([91.85, 21.6, 92.7, 23.75])).toBe("91.85,21.6,92.7,23.75");
    expect(bboxText([90.123456, 22.0, 90.98765, 22.5])).toBe("90.12,22,90.99,22.5");
  });
});
