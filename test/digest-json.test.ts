import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { readNight } from "../src/digest/reader.js";

const config = { adapter: "shim", installed: "2026-10-29T14:06:00+01:00", beatEverySeconds: 60, runsDir: "runs" };

describe("GET /api/digest/:night", () => {
  it("returns the reader rows in order", async () => {
    const res = await createApp(config).request("/api/digest/2026-10-28");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { night: string; rows: { job: string; owner: string | null }[]; badLines: number };
    expect(body.night).toBe("2026-10-28");
    expect(body.rows.map((r) => r.job)).toEqual([
      "digest/render",
      "fixtures/refresh",
      "lane/sync",
      "notes/backup",
      "rig/rotate-logs",
    ]);
    expect(body.rows).toEqual(readNight("runs", "2026-10-28")?.rows);
    expect(body.badLines).toBe(1);
    expect(body.rows.some((r) => r.owner === null)).toBe(true);
  });

  it("404s with JSON for a missing night", async () => {
    const res = await createApp(config).request("/api/digest/2030-01-01");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no such night" });
  });

  it("404s with JSON for a name that is not a date", async () => {
    const res = await createApp(config).request("/api/digest/not-a-date");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no such night" });
  });
});
