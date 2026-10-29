import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DigestRow, Night, ReadNight, RunStatus } from "./types.js";

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly string[] = ["ok", "retry", "fail"];

type Entry = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

// Parse one log line at the edge. Anything that is not a well-formed entry is a bad line.
function parseLine(line: string): Entry | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.at !== "string" || Number.isNaN(Date.parse(o.at))) return null;
  if (typeof o.job !== "string" || o.job === "") return null;
  if (typeof o.status !== "string" || !STATUSES.includes(o.status)) return null;
  return {
    at: o.at,
    job: o.job,
    status: o.status as RunStatus,
    owner: typeof o.owner === "string" && o.owner !== "" ? o.owner : null,
    error: typeof o.error === "string" && o.error !== "" ? o.error : null,
  };
}

// runs/<night>.jsonl into one row per job. Bad lines are counted, never thrown.
export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), "utf8");
  } catch {
    return null;
  }

  const byJob = new Map<string, Entry[]>();
  let badLines = 0;
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const entry = parseLine(line);
    if (entry === null) {
      badLines += 1;
      continue;
    }
    byJob.set(entry.job, [...(byJob.get(entry.job) ?? []), entry]);
  }

  const rows: DigestRow[] = [...byJob.entries()].map(([job, all]) => {
    // Order by time; the offset is kept for display, so compare instants. Ties keep file order.
    const entries = all
      .map((e, i) => ({ e, i }))
      .sort((a, b) => Date.parse(a.e.at) - Date.parse(b.e.at) || a.i - b.i)
      .map(({ e }) => e);
    const first = entries[0] as Entry;
    const last = entries[entries.length - 1] as Entry;
    const owner = [...entries].reverse().find((e) => e.owner !== null)?.owner ?? null;
    const lastError = [...entries].reverse().find((e) => e.error !== null)?.error ?? null;
    return {
      job,
      owner,
      runs: entries.length,
      retries: entries.filter((e) => e.status === "retry").length,
      lastStatus: last.status,
      lastError,
      firstAt: first.at,
      lastAt: last.at,
    };
  });
  rows.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));

  const result: Night = { night, rows, badLines };
  return result;
};
