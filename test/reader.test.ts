import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readNight } from "../src/digest/reader.js";

describe("readNight on the real night", () => {
  const night = readNight("runs", "2026-10-28");

  it("gives one row per job, sorted by job, and counts the bad line", () => {
    expect(night?.rows.map((r) => r.job)).toEqual([
      "digest/render",
      "fixtures/refresh",
      "lane/sync",
      "notes/backup",
      "rig/rotate-logs",
    ]);
    expect(night?.badLines).toBe(1);
  });

  it("counts runs and retries and keeps the last error and the times as logged", () => {
    const row = night?.rows.find((r) => r.job === "fixtures/refresh");
    expect(row).toEqual({
      job: "fixtures/refresh",
      owner: "rook",
      runs: 4,
      retries: 3,
      lastStatus: "ok",
      lastError: "upstream 503",
      firstAt: "2026-10-29T01:30:00+01:00",
      lastAt: "2026-10-29T01:37:00+01:00",
    });
  });

  it("keeps a row whose owner is null", () => {
    expect(night?.rows.find((r) => r.job === "digest/render")?.owner).toBeNull();
  });

  it("shows a failed job as failed with its error", () => {
    const row = night?.rows.find((r) => r.job === "notes/backup");
    expect(row?.lastStatus).toBe("fail");
    expect(row?.lastError).toBe("quota exceeded");
  });
});

describe("readNight on edge cases", () => {
  const dir = mkdtempSync(join(tmpdir(), "rig-runs-"));
  const write = (name: string, body: string) => writeFileSync(join(dir, `${name}.jsonl`), body);

  it("returns null for a night with no file", () => {
    expect(readNight(dir, "2030-01-01")).toBeNull();
  });

  it("returns null for a night name that is not a date, so it cannot leave the runs folder", () => {
    expect(readNight(dir, "../etc/passwd")).toBeNull();
    expect(readNight(dir, "2026-10-28/../../x")).toBeNull();
  });

  it("returns no rows for an empty file", () => {
    write("2030-01-02", "");
    expect(readNight(dir, "2030-01-02")).toEqual({ night: "2030-01-02", rows: [], badLines: 0 });
  });

  it("counts lines that parse but are not entries, without throwing", () => {
    write(
      "2030-01-03",
      [
        "not json",
        "[1,2]",
        JSON.stringify({ at: "nope", job: "a", status: "ok" }),
        JSON.stringify({ at: "2030-01-03T01:00:00+01:00", job: "a", status: "weird" }),
        JSON.stringify({ at: "2030-01-03T01:00:00+01:00", job: "a", status: "ok", owner: "x" }),
        "",
      ].join("\n"),
    );
    const n = readNight(dir, "2030-01-03");
    expect(n?.badLines).toBe(4);
    expect(n?.rows).toHaveLength(1);
  });

  it("orders a job by time, not by file order", () => {
    write(
      "2030-01-04",
      [
        JSON.stringify({ at: "2030-01-04T03:00:00+01:00", job: "j", status: "fail", owner: null, error: "late" }),
        JSON.stringify({ at: "2030-01-04T01:00:00+01:00", job: "j", status: "ok", owner: "o" }),
      ].join("\n"),
    );
    const row = readNight(dir, "2030-01-04")?.rows[0];
    expect(row?.lastStatus).toBe("fail");
    expect(row?.firstAt).toBe("2030-01-04T01:00:00+01:00");
    expect(row?.owner).toBe("o");
  });
});
