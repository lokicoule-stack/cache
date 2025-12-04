import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import importPlugin from 'eslint-plugin-import'
import tseslint from 'typescript-eslint'

export default [
  // Base configs
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // Global settings
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Main config
  {
    files: ['src/**/*.ts'],
    plugins: {
      '@stylistic': stylistic,
      'import': importPlugin,
    },
    rules: {
      // TypeScript strict rules
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',

      // Consistent type imports (auto-fix available)
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: true,
        },
      ],
      '@typescript-eslint/consistent-type-exports': [
        'error',
        {
          fixMixedExportsWithInlineTypeSpecifier: true,
        },
      ],

      // Naming convention - désactivé (trop strict)
      '@typescript-eslint/naming-convention': 'off',

      // Member ordering in classes/interfaces
      '@typescript-eslint/member-ordering': 'error',

      // Import sorting and organization
      'import/order': [
        'error',
        {
          'groups': [
            'builtin', // node:crypto, node:fs
            'external', // npm packages
            'internal', // @/alias
            'parent', // ../
            'sibling', // ./
            'index', // ./index
            'type', // import type
          ],
          'newlines-between': 'always',
          'alphabetize': {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/no-duplicates': ['error', { 'prefer-inline': true }],
      'import/newline-after-import': 'error',
      'import/no-unresolved': 'off', // TypeScript handles this

      // Code quality
      'no-console': 'off', // We use console for logging
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'no-nested-ternary': 'error',
      'no-unneeded-ternary': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
      'no-lonely-if': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'curly': ['error', 'all'],

      // Stylistic rules - Prettier handles most of these, keep only non-conflicting
      '@stylistic/ts/member-delimiter-style': [
        'error',
        {
          multiline: { delimiter: 'none' },
          singleline: { delimiter: 'semi' },
        },
      ],
      '@stylistic/ts/object-curly-spacing': ['error', 'always'],
      '@stylistic/ts/lines-between-class-members': [
        'error',
        'always',
        { exceptAfterSingleLine: true },
      ],
    },
  },

  // Test files configuration
  {
    files: ['src/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts', 'vitest.config.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },

  // Ignore files
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.config.js',
      '*.config.ts',
      '*.config.mjs',
    ],
  },
]
