import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

type Row = { job: string };

// runs/ is read-only, so every case here uses its own temp runs dir.
const dir = mkdtempSync(join(tmpdir(), "rig-routes-"));
const line = (o: Record<string, unknown>) => JSON.stringify(o);
const config = { adapter: "shim", installed: "2026-10-29T14:06:00+01:00", beatEverySeconds: 60, runsDir: dir };
const app = createApp(config);

beforeAll(() => {
  writeFileSync(join(dir, "2030-02-01.jsonl"), ""); // empty night
  writeFileSync(
    join(dir, "2030-02-02.jsonl"), // one good job, one bad line
    [line({ at: "2030-02-02T01:00:00+01:00", job: "b/job", status: "ok", owner: "rook" }), "{\"at\":\"2030-02-02T02:00"].join("\n"),
  );
  writeFileSync(
    join(dir, "2030-02-03.jsonl"), // sorted by job, null owner, three retries then a fail
    [
      line({ at: "2030-02-03T01:00:00+01:00", job: "z/last", status: "ok", owner: null }),
      line({ at: "2030-02-03T01:01:00+01:00", job: "a/first", status: "retry", owner: "rook", error: "boom" }),
      line({ at: "2030-02-03T01:02:00+01:00", job: "a/first", status: "retry", owner: "rook", error: "boom" }),
      line({ at: "2030-02-03T01:03:00+01:00", job: "a/first", status: "retry", owner: "rook", error: "boom" }),
      line({ at: "2030-02-03T01:04:00+01:00", job: "a/first", status: "fail", owner: "rook", error: "boom" }),
    ].join("\n"),
  );
});

const pageJobs = (html: string) =>
  [...html.matchAll(/<tr[^>]*><td>(?:<span class="warn">\[!\] <\/span>)?([^<]*)<\/td>/g)].map((m) => m[1]);

describe("GET /digest/:night", () => {
  it("answers 404 for a night with no file and for a name that is not a date", async () => {
    expect((await app.request("/digest/2030-12-31")).status).toBe(404);
    expect((await app.request("/digest/not-a-date")).status).toBe(404);
  });

  it("renders an empty night as nothing ran, with 200", async () => {
    const res = await app.request("/digest/2030-02-01");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("nothing ran");
  });

  it("renders the good rows and says how many bad lines were skipped", async () => {
    const res = await app.request("/digest/2030-02-02");
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(pageJobs(html)).toEqual(["b/job"]);
    expect(html).toContain("1 bad line(s) skipped");
  });

  it("sorts by job, shows — for a missing owner, and marks retries of 3 or more and fails", async () => {
    const html = await (await app.request("/digest/2030-02-03")).text();
    expect(pageJobs(html)).toEqual(["a/first", "z/last"]);
    expect(html).toContain("[!] </span>a/first");
    expect(html).not.toContain("[!] </span>z/last");
    expect(html).toContain("—");
  });
});

describe("GET /api/digest/:night", () => {
  it("answers 404 JSON for a night with no file", async () => {
    const res = await app.request("/api/digest/2030-12-31");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no such night" });
  });

  it("answers an empty night with no rows", async () => {
    const res = await app.request("/api/digest/2030-02-01");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: "2030-02-01", rows: [], badLines: 0 });
  });

  it("counts the bad line", async () => {
    const body = (await (await app.request("/api/digest/2030-02-02")).json()) as { rows: Row[]; badLines: number };
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(1);
  });
});

describe("the page and the JSON never disagree", () => {
  it.each(["2030-02-02", "2030-02-03"])("%s has the same jobs in the same order", async (night) => {
    const html = await (await app.request(`/digest/${night}`)).text();
    const json = (await (await app.request(`/api/digest/${night}`)).json()) as { rows: Row[] };
    expect(json.rows.map((r) => r.job)).toEqual(pageJobs(html));
  });

  it("the real nights too, and the board links to each of them", async () => {
    const real = createApp({ ...config, runsDir: "runs" });
    const board = await (await real.request("/")).text();
    for (const night of ["2026-10-28", "2026-10-27"]) {
      expect(board).toContain(`href="/digest/${night}"`);
      const page = await real.request(`/digest/${night}`);
      expect(page.status).toBe(200);
      const json = (await (await real.request(`/api/digest/${night}`)).json()) as { rows: Row[] };
      expect(json.rows.map((r) => r.job)).toEqual(pageJobs(await page.text()));
    }
  });
});
