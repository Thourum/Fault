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

export default defineConfig({
  plugins: [
    {
      enforce: 'pre',
      ...mdx({
        providerImportSource: '@mdx-js/react',
        rehypePlugins: [[rehypeShiki, { theme: 'vesper' }]],
      }),
    },
    react(),
    tailwindcss(),
  ],
  define: { __FAULT_VERSION__: JSON.stringify(faultPkg.version) },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        docs: resolve(import.meta.dirname, 'docs/index.html'),
      },
    },
  },
})
