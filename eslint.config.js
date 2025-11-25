// eslint.config.js
import js from '@eslint/js'
import perfectionist from 'eslint-plugin-perfectionist'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/.vitest/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      perfectionist,
    },
    rules: {
      // ========================================================================
      // TypeScript Strict Rules
      // ========================================================================

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
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
          disallowTypeAnnotations: true,
        },
      ],
      '@typescript-eslint/consistent-type-exports': [
        'error',
        {
          fixMixedExportsWithInlineTypeSpecifier: true,
        },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['PascalCase'],
        },
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'],
        },
        {
          selector: 'objectLiteralProperty',
          format: null,
        },
      ],

      // Private fields must use #
      '@typescript-eslint/class-literal-property-style': ['error', 'fields'],
      '@typescript-eslint/prefer-private-fields': 'error',

      // Promise handling
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            arguments: false,
            attributes: false,
          },
        },
      ],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/promise-function-async': 'error',

      // Type safety
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowString: false,
          allowNumber: false,
          allowNullableObject: false,
          allowNullableBoolean: false,
          allowNullableString: false,
          allowNullableNumber: false,
          allowAny: false,
        },
      ],

      // Array handling
      '@typescript-eslint/prefer-for-of': 'error',
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/prefer-readonly': 'error',

      // Style preferences
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // ========================================================================
      // Import Organization (Perfectionist)
      // ========================================================================

      'perfectionist/sort-imports': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          ignoreCase: true,
          internalPattern: ['^@/.+', '^~/.+'],
          newlinesBetween: 'always',
          maxLineLength: undefined,
          groups: [
            'type',
            ['builtin', 'external'],
            'internal-type',
            'internal',
            ['parent-type', 'sibling-type', 'index-type'],
            ['parent', 'sibling', 'index'],
            'object',
            'unknown',
          ],
        },
      ],

      'perfectionist/sort-named-imports': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          ignoreCase: true,
          groupKind: 'types-first',
        },
      ],

      'perfectionist/sort-exports': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          ignoreCase: true,
        },
      ],

      // ========================================================================
      // Code Quality
      // ========================================================================

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'object-shorthand': ['error', 'always'],
      'no-nested-ternary': 'error',
      'no-unneeded-ternary': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'no-implicit-coercion': 'error',

      // ========================================================================
      // Code Style
      // ========================================================================

      'perfectionist/sort-objects': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          ignoreCase: true,
          partitionByComment: false,
        },
      ],

      'perfectionist/sort-classes': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          ignoreCase: true,
          groups: [
            'index-signature',
            'static-property',
            'private-property',
            'property',
            'constructor',
            'static-method',
            'private-method',
            'method',
            'unknown',
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
)