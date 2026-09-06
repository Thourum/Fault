# apps/site

Bun only (`bun install`, `bun run`, `bun x`). `bun run local-ci` before committing.

- Two Vite entries: `index.html` (landing) and `docs/index.html` (docs). No router.
- Docs content: `src/content/*.mdx`; order in `src/docs/sections.ts`. Each file starts with `## <Title>` matching its entry.
- Code samples must be verified against `../../packages/fault/src` — never written from memory.
- `src/content/agents.mdx` embeds `../../skills/*/SKILL.md` via `src/docs/SkillList.tsx`. Skill files are the source of truth; their API claims follow the same verification rule.
- Design tokens live in `src/styles.css` `@theme`; no raw colors in components.
- Deploy: `wrangler.jsonc` (assets only). See README.
