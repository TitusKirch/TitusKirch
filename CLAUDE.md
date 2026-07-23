# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

The GitHub profile repository for `TitusKirch` — its `README.md` is what renders on the profile page. The repo contains no application code: it is a **manifest (`projects.yml`) + renderer (`scripts/render-readme.mjs`)** that keeps the "Projects" section of the README in sync with live GitHub repo metadata.

## Commands

```bash
pnpm install                 # pnpm 11, Node >= 24 (.nvmrc: 24)
pnpm check                   # lint + format check (what CI runs)
pnpm check:fix               # oxlint --fix + oxfmt write
pnpm lint / pnpm format      # individually
GITHUB_TOKEN=… pnpm render   # regenerate the README projects block in place
pnpm taze / pnpm taze:w      # dependency update check / write
```

There is no test suite. The renderer's "test" is the CI smoke job: run `pnpm render`, then `git diff --exit-code README.md` — a non-empty diff means the committed README is out of sync with `projects.yml` + GitHub.

`pnpm render` requires `GITHUB_TOKEN` or `GH_TOKEN` (a plain `gh auth token` value works locally) and exits non-zero if it is missing.

## How the render pipeline works

1. `projects.yml` declares `min_stars` and ordered `categories`, each with `items` of `{ repo: owner/name, emoji, logo?, }`. Category-level `intro` text is rendered under the heading.
2. `scripts/render-readme.mjs` fetches `https://api.github.com/repos/<slug>` for **every** item in parallel and takes the repo **name, URL, description and star count from GitHub** — never from the YAML. The YAML only decides _which_ repos appear, in what order, under which heading, and with which icon.
3. It **fails hard** (exit 1) if any listed repo has an empty GitHub description, printing the `gh repo edit … --description` fix. Descriptions live on GitHub; the fix is to set them there, not in this repo.
4. A star badge is appended only when `stargazers_count >= min_stars`; `formatStars` switches to `1.2k+` style above 1000.
5. The output replaces everything between `<!-- PROJECTS:START -->` and `<!-- PROJECTS:END -->` in `README.md`. Missing markers = exit 1.

**Never hand-edit the block between the PROJECTS markers** — edit `projects.yml` (or the repo's GitHub description) and re-render. Everything outside the markers (intro, badges, Connect section) is hand-maintained.

`scripts/bootstrap-descriptions.mjs` is a one-shot historical migration: it parsed descriptions out of the README and pushed them to GitHub via `gh repo edit` for repos that had none. It is not part of the normal flow.

## Automation

- `.github/workflows/sync-projects.yml` — daily cron (06:17), on push to `main` touching `projects.yml`/the renderer, or manual. Renders, then force-points the `bot/sync-projects` branch at `main`'s tip and commits `README.md` **through the GitHub Contents API** rather than with `git push`. This is deliberate: API commits made with `GITHUB_TOKEN` are signed/"Verified", which satisfies the `required_signatures` branch protection on `main`. It reuses an already-open PR instead of opening a second one.
- `.github/workflows/cleanup-sync-branch.yml` — deletes `bot/sync-projects` once its PR merges.
- `.github/workflows/ci.yml` — lint/format + renderer smoke on PRs into `main` (skipped for drafts).
- `.github/workflows/codeql.yml` — JS/TS + actions analysis.

## Conventions

- **Tooling is oxc**: `oxlint` (correctness = error, `--deny-warnings`) and `oxfmt` (single quotes, 2 spaces, width 80, no trailing comma). `README.md`, `CHANGELOG.md` and `pnpm-lock.yaml` are excluded from formatting — do not reformat them.
- **Commits**: Conventional Commits, enforced by commitlint via husky `commit-msg`; `pre-commit` runs lint-staged.
- **Branching**: work targets `main`; the `dev` integration branch was dropped (`478d266`, PR #38) along with its `dev-pr.yml` workflow, and Dependabot plus `.tituskirch-skills.json` (`pr.base`) now point at `main`. `main` is protected by rules `pull_request`, `required_signatures`, `non_fast_forward`, `deletion` — so a direct push is rejected and changes go through a PR with signed commits.
- **pnpm settings live in `pnpm-workspace.yaml`**, not `.npmrc` (pnpm 10+ reads only auth/registry from `.npmrc`). Notably `minimumReleaseAge: 4320` (3 days) — mirrored by the Dependabot `cooldown` — and `preferFrozenLockfile`.
- `.tituskirch-skills.json` configures the TitusKirch agent skills for this repo: English, GitHub for PRs and issues, conventional PR titles, plain issue titles.
