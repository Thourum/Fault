import { existsSync, readFileSync } from 'node:fs'

const pages = ['dist/index.html', 'dist/docs/index.html']
for (const p of pages) {
  if (!existsSync(p)) throw new Error(`missing ${p}`)
  const html = readFileSync(p, 'utf8')
  if (!/<script type="module"[^>]+src="\/assets\//.test(html)) {
    throw new Error(`${p}: no bundled script`)
  }
}
console.log(`smoke ok: ${pages.join(', ')}`)
