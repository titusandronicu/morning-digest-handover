// The morning digest: one row per job for one night of runs/<night>.jsonl.
// Written first (issue #1) so the reader and every part of the digest page can build against it.

export type RunStatus = "ok" | "retry" | "fail";

export type DigestRow = {
  job: string;
  // The log can leave the owner out or null. The row is kept; views show it as —.
  owner: string | null;
  // Log lines for this job.
  runs: number;
  // Log lines for this job with status "retry".
  retries: number;
  // Status of the job's last line, by time.
  lastStatus: RunStatus;
  // Error of the last line that had one, or null.
  lastError: string | null;
  // First and last time of the job, exactly as logged (offset kept, never converted).
  firstAt: string;
  lastAt: string;
};

export type Night = {
  // The night as named on disk, YYYY-MM-DD.
  night: string;
  // One row per job, sorted by job.
  rows: DigestRow[];
  // Lines that did not parse. Counted, never thrown.
  badLines: number;
};

// null means no runs/<night>.jsonl exists (the page answers 404). An empty file gives a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
