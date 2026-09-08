import { resolve } from 'node:path'
import { defineConfig } from '@rspress/core'

export default defineConfig({
  root: 'docs',
  title: 'fault',
  description: 'Result types for TypeScript with rich, traceable Fault errors.',
  icon: '/favicon.svg',
  logo: { light: '/logo/light.svg', dark: '/logo/dark.svg' },
  logoText: 'fault',
  globalStyles: resolve(import.meta.dirname, 'theme/styles.css'),
  // Cloudflare's html_handling serves /foo.html for /foo (see wrangler.jsonc).
  route: { cleanUrls: true },
  themeConfig: {
    socialLinks: [{ icon: 'github', mode: 'link', content: 'https://github.com/Thourum/Fault' }],
    footer: { message: 'MIT License · Inspired by neverthrow' },
    enableScrollToTop: true,
  },
})
