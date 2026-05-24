# Agent Guide

Central entry point for coding agents and contributors working in this repo.

Related docs:

- [CODEX.md](./CODEX.md)
- [CLAUDE.md](./CLAUDE.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [README.md](./README.md)
- [AGENTS.md](./AGENTS.md) - repository-local instructions consumed by coding agents

## Start Here

1. Read [README.md](./README.md) for product scope, architecture, and run modes.
2. Read [CONTRIBUTING.md](./CONTRIBUTING.md) for branch, PR, and review process.
3. Use [CODEX.md](./CODEX.md) or [CLAUDE.md](./CLAUDE.md) only as tool-specific overlays. They do not replace this file or the repo-local rules in [AGENTS.md](./AGENTS.md).

## Repo Context Expectations

- Understand which layer you are touching before editing: `frontend/src/app`, `frontend/src/lib`, or `backend/src/find_api`.
- Keep routers thin in the backend. Storage, queue, database, and ML logic should stay in their existing modules.
- Do not propose or implement structure changes until you understand the current upload, job queue, indexing, search, and clustering flow described in [README.md](./README.md).
- Reuse existing commands, file locations, and naming conventions from the repo. Do not invent new workflow steps in docs or PR notes.

## Contributor Workflow

1. Start from an assigned or clearly scoped issue.
2. Keep the branch and PR focused on one change.
3. Prefer the light stack for routine UI, API, docs, and workflow work:

```bash
docker compose -f docker-compose.light.yml up --build
```

4. Use the full stack only when the change needs real ML behavior:

```bash
docker compose up --build
```

5. Before opening a PR, run the checks relevant to the files you changed.

## Architecture Before Implementation

- Trace the user-visible flow before changing behavior: upload, worker processing, status polling, gallery, search, and clustering.
- If a change crosses frontend and backend boundaries, verify the API contract and state flow before editing either side.
- For docs or workflow changes, confirm the commands already exist and match the current repository.

## Anti-Slop Rules

- Avoid generic AI-generated process text, padded explanations, or broad best-practice lists detached from this repo.
- Do not restate architecture you have not verified in the codebase or existing docs.
- Do not hide uncertainty. If a workflow or dependency is unclear, call it out directly in the PR.
- Prefer small, reviewable diffs over speculative cleanup.

## Testing And Review

- Frontend changes:

```bash
cd frontend
pnpm check
pnpm build
```

- Backend changes:

```bash
cd backend
uv run ruff check .
uv run ruff format --check .
uv run pytest tests/ -v
```

- Integration-impacting changes should also mention manual verification for upload, job status polling, gallery, search, and clustering.
- PRs should link the issue, explain the change, include test notes, and include screenshots for UI changes.

## Keep It Maintainable

- Update this file only for shared guidance that should apply across agents.
- Keep tool-specific behavior in [CODEX.md](./CODEX.md) and [CLAUDE.md](./CLAUDE.md).
- If repo workflow changes, update the source docs here and in [CONTRIBUTING.md](./CONTRIBUTING.md) rather than duplicating process notes elsewhere.
