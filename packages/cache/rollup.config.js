import alias from '@rollup/plugin-alias'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import { dirname, resolve } from 'path'
import dts from 'rollup-plugin-dts'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const aliasConfig = alias({
  entries: [{ find: '@', replacement: resolve(__dirname, 'src') }],
})

export default [
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: [
      aliasConfig,
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
      terser(),
    ],
  },
  // Type definitions
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es',
    },
    external: [/node_modules/],
    plugins: [aliasConfig, dts()],
  },
]
