import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import mdx from '@mdx-js/rollup'
import rehypeShiki from '@shikijs/rehype'

const faultPkg = JSON.parse(
  readFileSync(resolve(__dirname, '../../packages/fault/package.json'), 'utf8'),
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
        main: resolve(__dirname, 'index.html'),
        docs: resolve(__dirname, 'docs/index.html'),
      },
    },
  },
})
