# fault docs

[Rspress](https://rspress.rs) site for `@thourum/fault`. Bun only.

```sh
bun install
bun run dev        # http://localhost:3000
bun run local-ci   # sync skills, fail on drift, build to doc_build/
```

- Pages: `docs/**/*.mdx`. Sidebar order: `_meta.json` in each directory (global sidebar from `docs/_meta.json`).
- `docs/guides/skills/*.mdx` are generated from `../../skills/*/SKILL.md` by `bun run sync-skills`. Edit the skill, then re-run; CI fails on drift.
- Theme tokens: `theme/styles.css` (Rspress CSS variables; same palette as `apps/site`).
- Every code sample must match `../../packages/fault/src`.


## Deploy (Cloudflare Workers, static assets)

```sh
bun x wrangler login
bun run deploy
```

`wrangler.jsonc` serves `doc_build/`. Also deployable to any static host.
