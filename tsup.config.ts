import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/drivers/index.ts', 'src/middlewares/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
  skipNodeModulesBundle: true,
  platform: 'node',
  external: ['ioredis', 'msgpackr'],
})
