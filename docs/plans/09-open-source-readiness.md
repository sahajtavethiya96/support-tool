# Plan: Open-source readiness

**Deferred** — the team chose to prioritize functionality (password login,
sign-in toggles, etc.) first. This plan captures the gap-finding audit done
earlier so it isn't lost, to be picked up before the repo goes public.

Full findings are in the conversation history; this is the actionable
checklist distilled from that audit.

## 🔴 Must-fix before going public

### 1. No `LICENSE` file

The README already claims "MIT" in prose (tech-stack section) but there's
no actual `LICENSE`/`LICENSE.md` at the repo root. A real legal gap, not
cosmetic — add a standard MIT license file with the correct copyright
holder/year.

### 2. `package.json` missing OSS metadata

Currently has `"private": true` (contradictory for a public OSS repo) and
is missing `license`, `repository`, `description`, `author`, `keywords`.

```json
{
  "name": "support-tool",
  "version": "0.1.0",
  "description": "Open-source, self-hosted customer support ticketing system.",
  "license": "MIT",
  "repository": { "type": "git", "url": "https://github.com/<org>/support-tool" },
  "keywords": ["support", "helpdesk", "ticketing", "self-hosted", "nextjs"]
}
```

Remove `"private": true` once the repo is actually meant to be publishable
(keep it until then so `npm publish` etc. can't happen by accident).

### 3. README's clone URL is a placeholder

`github.com/your-org/support-tool` needs to point at the real repo once it
has a public home. Search the README for this placeholder and any other
`your-org`/`yourco.com` stand-ins (e.g. the `NEXT_PUBLIC_APP_URL` example).

## 🟡 Should-fix — bootstrapping/docs gaps

### 4. `docs/commands.md` — partially addressed already

Was missing `pnpm setup`, `pnpm seed`/`db:seed`, `pnpm create:admin`
entirely — **this was fixed while building password login** (see the
"Quick Start" and "Database" sections, updated to include all three plus
the new password-argument form of `create:admin`). Re-check this file is
still accurate if the command surface changes further.

### 5. No `.github/` directory

No CI workflow at all — not even a typecheck/lint/build check on PRs. No
issue templates, no PR template. `CONTRIBUTING.md` exists; `CODE_OF_CONDUCT.md`
does not.

Minimum viable CI (`​.github/workflows/ci.yml`):

```yaml
name: CI
on: [pull_request, push]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      # build likely needs a DATABASE_URL / dummy env — verify before adding
```

Add `.github/ISSUE_TEMPLATE/bug_report.md`, `feature_request.md`, and
`.github/PULL_REQUEST_TEMPLATE.md` — keep them short, this is a small OSS
project, not a large foundation-governed one.

## 🟢 Nice-to-have

### 6. No screenshots in the README

First impression matters a lot for OSS adoption — add 2-4 screenshots
(agent ticket view, customer portal, admin dashboard) near the top.

### 7. Already flagged in `docs/development-plan.md`

- One-click deploy buttons/manifests (Railway/Render/Fly) — currently only
  documented generically in the README.
- `GET /api/health` endpoint for container healthchecks.
- CSAT + CSV export (see `docs/development-plan.md` for full scope).

## ✅ Already in good shape (confirmed during the audit, no action needed)

- `.env.example` — complete, matches `lib/env.ts`'s schema exactly. (Briefly
  gained `FIRST_ADMIN_EMAIL`/`NAME`/`PASSWORD` alongside password login, then
  removed again — first-admin creation is a deliberate manual step,
  `pnpm create:admin`, not automatic on startup. A silent failure inside a
  detached `docker compose up -d` service is worse than an explicit command
  with visible terminal output — see `docs/commands.md`.)
- `Dockerfile`, `Dockerfile.worker`, `docker-compose.yml`, `.dockerignore`
  — all present and functional.
- Admin bootstrap scripts (`scripts/setup.ts`, `scripts/create-admin.ts`,
  `scripts/make-admin.ts`) — all exist, documented, and tested.
- No secrets accidentally committed — `.env` is properly gitignored, only
  placeholders in `.env.example`.

## Task checklist

- [ ] Add `LICENSE` (MIT, confirm copyright holder name with the team first)
- [ ] Fill in `package.json` metadata, remove `"private": true` when ready to publish
- [ ] Replace `your-org`/placeholder URLs in README with the real repo URL
- [ ] Add `.github/workflows/ci.yml` (typecheck + lint at minimum)
- [ ] Add `.github/ISSUE_TEMPLATE/` + `PULL_REQUEST_TEMPLATE.md`
- [ ] Add `CODE_OF_CONDUCT.md`
- [ ] Add README screenshots
- [ ] Revisit `/api/health` + one-click deploy manifests (own smaller plans if built)

## Out of scope (for this plan)

- CSAT + CSV export — large enough to warrant its own plan doc if picked up
- Full CI matrix (multiple Node versions, OS matrix) — overkill for this project's size
