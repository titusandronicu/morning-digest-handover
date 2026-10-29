import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const config = { adapter: "shim", installed: "2026-10-29T14:06:00+01:00", beatEverySeconds: 60, runsDir: "runs" };

async function get(path: string) {
  const res = await createApp(config).request(path);
  return { status: res.status, html: await res.text() };
}

function rowOf(html: string, job: string): string {
  const m = html.match(new RegExp(`<tr[^>]*>(?:(?!</tr>).)*${job}(?:(?!</tr>).)*</tr>`));
  return m ? m[0] : "";
}

describe("digest page", () => {
  it("lists the jobs of the night in sorted order", async () => {
    const { status, html } = await get("/digest/2026-10-28");
    expect(status).toBe(200);
    const jobs = ["digest/render", "fixtures/refresh", "lane/sync", "notes/backup", "rig/rotate-logs"];
    const at = jobs.map((j) => html.indexOf(j));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("marks retries >= 3 and failed rows with a class and a text marker", async () => {
    const { html } = await get("/digest/2026-10-28");
    for (const job of ["fixtures/refresh", "notes/backup"]) {
      const row = rowOf(html, job);
      expect(row).toContain("flag");
      expect(row).toContain("[!]");
    }
    expect(rowOf(html, "lane/sync")).not.toContain("[!]");
  });

  it("shows — for a null owner", async () => {
    const { html } = await get("/digest/2026-10-28");
    expect(rowOf(html, "digest/render")).toContain("<td>—</td>");
  });

  it("keeps the logged offset", async () => {
    const { html } = await get("/digest/2026-10-28");
    expect(html).toContain("2026-10-28T23:00:02+01:00");
  });

  it("answers 404 in the layout for a night without a file", async () => {
    const { status, html } = await get("/digest/2030-01-01");
    expect(status).toBe(404);
    expect(html).toContain("<header>");
  });

  it("answers 404 for a name that is not a date", async () => {
    expect((await get("/digest/nope")).status).toBe(404);
  });
});
