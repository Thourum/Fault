import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import mdx from '@mdx-js/rollup'
import rehypeShiki from '@shikijs/rehype'

const faultPkg = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../packages/fault/package.json'), 'utf8'),
)

// skills/*/SKILL.md carry YAML frontmatter for agent tooling; drop it before MDX sees the file.
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/

export default defineConfig({
  plugins: [
    {
      name: 'strip-skill-frontmatter',
      enforce: 'pre',
      transform: (code, id) => (id.endsWith('/SKILL.md') ? code.replace(FRONTMATTER, '') : null),
    },
    {
      enforce: 'pre',
      ...mdx({
        providerImportSource: '@mdx-js/react',
        rehypePlugins: [[rehypeShiki, { theme: 'github-light' }]],
      }),
    },
    react(),
    tailwindcss(),
  ],
  define: { __FAULT_VERSION__: JSON.stringify(faultPkg.version) },
  // SKILL.md files live outside this package; resolve MDX's runtime imports from here.
  resolve: {
    alias: {
      'react/jsx-runtime': resolve(import.meta.dirname, 'node_modules/react/jsx-runtime.js'),
      '@mdx-js/react': resolve(import.meta.dirname, 'node_modules/@mdx-js/react/index.js'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        docs: resolve(import.meta.dirname, 'docs/index.html'),
      },
    },
  },
})
