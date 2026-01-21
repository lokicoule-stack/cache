import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@test': resolve(__dirname, './tests/support'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests-old/**', 'node_modules/**'],
    typecheck: {
      enabled: true,
      include: ['tests/types/**/*.test-d.ts'],
      tsconfig: './tsconfig.test.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.test-d.ts',
        '**/*.spec.ts',
        '**/*.config.*',
        '**/index.ts',
        'src/contracts/**',
        'src/types/**',
        'benchmarks/**',
        'tests/**',
        '**/*-factory.ts',
        '**/*-config.ts',
        'src/debug.ts',
      ],
    },
  },
})
