# fault site

Landing page (`/`) and docs (`/docs/`) for `@thourum/fault`. Bun + Vite + React + Tailwind + MDX.

## Develop

```sh
bun install
bun run dev
bun run local-ci   # typecheck, build, smoke
```

Docs content lives in `src/content/*.mdx`, one file per section, ordered in `src/docs/sections.ts`. Every sample must match `packages/fault/src`.

The "For AI agents" section renders the repo's `skills/*/SKILL.md` files directly (`src/docs/SkillList.tsx`); a small Vite plugin strips their YAML frontmatter. Edit the skill, not the site.

## Deploy (Cloudflare Workers, static assets)

```sh
bun x wrangler login
bun run build && bun run deploy
```

Custom subdomain: Cloudflare dashboard → Workers & Pages → `fault-site` → Settings → Domains & Routes → Add → Custom domain (e.g. `fault.itterno.dev`). DNS is created automatically when the zone is on Cloudflare.

CI: connect the repo under Workers & Pages → Create → Import a repository, root `apps/site`, build `bun run build`, deploy `bun x wrangler deploy`.

Also deployable to any static host from `dist/` (Vercel: framework Vite, root `apps/site`).
