import { describe, expect, it } from "vitest";
import { buildHealthReport, httpStatusFor } from "@/lib/health";

const now = new Date("2026-11-14T06:00:00Z");

describe("buildHealthReport", () => {
  it("is ok when the database answers with PostGIS, even before any data is loaded", () => {
    const report = buildHealthReport(
      { latencyMs: 12.6, postgis: "3.6.4", activeModel: null, latestIngest: null },
      now,
    );
    expect(report).toEqual({
      status: "ok",
      db: { ok: true, latencyMs: 13, postgis: "3.6.4" },
      data: { activeModel: null, latestIngest: null },
      time: "2026-11-14T06:00:00.000Z",
    });
    expect(httpStatusFor(report)).toBe(200);
  });

  it("reports the active model and latest ingest time", () => {
    const report = buildHealthReport(
      {
        latencyMs: 5,
        postgis: "3.6.4",
        activeModel: "v1",
        latestIngest: new Date("2026-11-13T20:30:00Z"),
      },
      now,
    );
    expect(report.data).toEqual({ activeModel: "v1", latestIngest: "2026-11-13T20:30:00.000Z" });
  });

  it("is degraded (HTTP 200) when PostGIS is missing", () => {
    const report = buildHealthReport(
      { latencyMs: 5, postgis: null, activeModel: null, latestIngest: null },
      now,
    );
    expect(report.status).toBe("degraded");
    expect(httpStatusFor(report)).toBe(200);
  });

  it("is down (HTTP 503) when the probe failed, without leaking error details", () => {
    const secret = "postgresql://user:password@host/db";
    const report = buildHealthReport(new Error(`connect failed: ${secret}`), now);
    expect(report.status).toBe("down");
    expect(report.db.ok).toBe(false);
    expect(httpStatusFor(report)).toBe(503);
    expect(JSON.stringify(report)).not.toContain("password");
  });
});
