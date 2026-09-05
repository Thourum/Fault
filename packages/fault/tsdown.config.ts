import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    fetch: 'src/fetch/index.ts',
    zod: 'src/zod/index.ts',
    drizzle: 'src/drizzle/index.ts',
    pg: 'src/pg/index.ts',
    std: 'src/std/index.ts',
  },
  format: ['esm'],
  platform: 'node',
  dts: true,
  clean: true,
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
})
