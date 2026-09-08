# apps/docs

Bun only. `bun run local-ci` before committing.

- Rspress; `root: 'docs'`. Sidebar from `_meta.json` files, navbar from `docs/_nav.json`.
- `docs/guides/skills/` is generated from `skills/*/SKILL.md` — never edit by hand; run `bun run sync-skills`.
- Frontmatter `title` + body `# H1` must match. Descriptions are plain text (no backticks/generics needed, but they are allowed here unlike Mintlify).
- Code samples verified against `../../packages/fault/src`; skill files follow the same rule.
- Theme vars only in `theme/styles.css`; no raw colors in MDX.
