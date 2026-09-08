// Copies skills/*/SKILL.md into docs/guides/skills/*.mdx so the docs show the
// exact file agents read. `skills/` is the source of truth; never edit the output.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../../..')
const OUT = resolve(import.meta.dirname, '../docs/guides/skills')
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/

mkdirSync(OUT, { recursive: true })
for (const name of readdirSync(resolve(ROOT, 'skills'))) {
  const raw = readFileSync(resolve(ROOT, 'skills', name, 'SKILL.md'), 'utf8')
  const fm = raw.match(FRONTMATTER)
  if (!fm) throw new Error(`${name}/SKILL.md has no frontmatter`)
  const description = fm[1].match(/^description:\s*(.+)$/m)?.[1].replace(/^"|"$/g, '') ?? ''
  const body = raw.slice(fm[0].length).trimStart() // keeps the skill's own H1
  const page = `---
title: ${JSON.stringify(name)}
description: ${JSON.stringify(description)}
---

{/* Generated from skills/${name}/SKILL.md by scripts/sync-skills.ts. Edit the skill, not this file. */}

${body.replace(/^(# .+\n)/, `$1\n\`\`\`sh\nnpx skills add Thourum/Fault --skill ${name}\n\`\`\`\n`)}`
  writeFileSync(resolve(OUT, `${name}.mdx`), page)
  console.log(`guides/skills/${name}.mdx`)
}
