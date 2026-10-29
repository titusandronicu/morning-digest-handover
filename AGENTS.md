# rig

The lane's resident service: keeps a heartbeat, serves the status board, reads the night's run
log. Hono + JSX, rendered on the server, Node 22+.

Read first: `docs/vision.md`, `docs/styleguide.md`. Decisions: `docs/adr/`.

## Commands

- `pnpm dev` / `pnpm start`: serves on `PORT` (8787). Needs `.env` (copy `.env.example`).
- `pnpm test`: vitest. `pnpm typecheck`: tsc.

## How work moves here

1. A feature starts as a plan: `plan.md` at the root (one at a time). Finished plans live in
   `docs/plans/done/`.
2. The plan is split into GitHub issues: skill `plan-to-issues` (`.agents/skills/`). A human
   reviews the split before anything is published. GitHub issues out of reach: files in
   `docs/issues/` (ADR 0004).
3. Issues are worked by workers, one issue per worker, each on its own branch or worktree.
   Pick the model per issue: the strongest for logic, a cheaper one for views and tests.
4. A worker closes its issue with a closing comment, exactly this shape:

   ```
   done: <what changed, one line>
   worker: <harness> · <model> · <effort>
   commit: <sha or "none">
   ```

5. An issue is closed only when its "Done when" holds. If it can't hold yet, leave it open and
   say what it waits on.

## Issue shape

Every issue split from a plan carries the same things (the owner chose this on 2026-10-29; the skill
`plan-to-issues` asks about it unless it is written here):

1. First line: `Source: plan.md § <n>` (the section of the plan it comes from).
2. Label: `plan:<plan name>`, so the reviewer can sort by plan.
3. Sections, in this order: Scope · Done when (copied from the plan) · Blocked by (`#n`, and say
   "to start" or "to close" when they differ) · Suggested worker (harness · model · effort).
4. The closing comment from "How work moves here", with the worker line that is true, and with
   `closes #n` in the commit message.

A preview of a plan never goes into the repo, an issue or a chat attachment (ADR 0003); host it
outside the repo and take its marker off once the review is in.

## Skills

Shared skills live in `.agents/skills/`, one folder each, `SKILL.md` inside. That folder is the
one source for every harness on the team. If yours loads skills from somewhere else, point it
here (a link or a config entry). Don't copy: copies drift.

## Rules

- Never commit `.env`, tokens or previews.
- Don't touch `runs/`: those are real nights, read-only fixtures.
- No client JS (ADR 0001).
