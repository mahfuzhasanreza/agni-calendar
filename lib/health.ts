/** What the health check reads from the database. */
export type HealthProbe = {
  latencyMs: number;
  /** Installed PostGIS version, or null if the extension is missing. */
  postgis: string | null;
  /** Active calibration model version, or null before the first pipeline load. */
  activeModel: string | null;
  /** Finish time of the latest successful ingest run, or null if none. */
  latestIngest: Date | null;
};

export type HealthStatus = "ok" | "degraded" | "down";

export type HealthReport = {
  status: HealthStatus;
  db: { ok: boolean; latencyMs: number | null; postgis: string | null };
  data: { activeModel: string | null; latestIngest: string | null };
  time: string;
};

/**
 * Turns a database probe (or the error it threw) into the public health report.
 * - down: the database could not be queried
 * - degraded: reachable, but PostGIS is missing (spatial queries would fail)
 * - ok: reachable with PostGIS (having no data loaded yet is still ok)
 * Error details are never included: they can contain hostnames or connection strings.
 */
export function buildHealthReport(
  probe: HealthProbe | Error,
  now: Date = new Date(),
): HealthReport {
  if (probe instanceof Error) {
    return {
      status: "down",
      db: { ok: false, latencyMs: null, postgis: null },
      data: { activeModel: null, latestIngest: null },
      time: now.toISOString(),
    };
  }
  return {
    status: probe.postgis ? "ok" : "degraded",
    db: { ok: true, latencyMs: Math.round(probe.latencyMs), postgis: probe.postgis },
    data: {
      activeModel: probe.activeModel,
      latestIngest: probe.latestIngest ? probe.latestIngest.toISOString() : null,
    },
    time: now.toISOString(),
  };
}

/** HTTP status for a report: 503 only when the database is down. */
export function httpStatusFor(report: HealthReport): number {
  return report.status === "down" ? 503 : 200;
}
