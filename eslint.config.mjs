import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const eslintConfig = defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Node globals everywhere, and `no-undef` off for TypeScript: the compiler
  // already resolves every identifier, and the base rule cannot see type-only
  // declarations, so it reports false positives on them.
  {
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.ts'],
    rules: { 'no-undef': 'off' },
  },

  // 1. Import sorting, unused vars, and type imports.
  //
  // Sorting is `simple-import-sort` rather than the product repo's
  // `eslint-plugin-import-x`, and that is deliberate. import-x depends on
  // `unrs-resolver`, whose per-platform native bindings reach an optional
  // wasm32-wasi package that declares `@emnapi/core` and `@emnapi/runtime` as
  // PEERS. Installing on Windows prunes that branch, so npm never writes those
  // peers into package-lock.json — and `npm ci` on Linux then refuses the lock
  // as out of sync. Regenerating the lock does not fix it, and neither do
  // npm's --os/--cpu overrides; the entries are simply never resolved.
  // `eslint-plugin-import` is not an option either: its peer range stops at
  // ESLint 9. simple-import-sort has ZERO dependencies, so the whole class is
  // gone. The product repo does not hit this because bun resolves differently.
  //
  // The groups below reproduce the previous layout exactly — builtins, then
  // external, then relative — so no import block had to be rewritten.
  {
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      // `_`-prefixed names are an intentional discard (rest destructuring).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^\\u0000'], // side effects
            ['^node:'],
            ['^@?\\w'], // external packages
            ['^'], // anything else absolute
            ['^\\.'], // relative
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
      'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
      'prefer-arrow-callback': ['error', { allowNamedFunctions: true }],
      'arrow-body-style': ['error', 'as-needed'],
    },
  },

  // 2. No floating promises.
  //
  // Type-aware, and worth its cost here more than anywhere: this package is a
  // network client and a CLI, so nearly every function is async. A dropped
  // rejection in `ot` is not a logged warning — it is an exit code of 0 on a
  // transcription that never happened, which is the single worst thing this
  // tool can do.
  //
  // The rule accepts `void promise`. DO NOT USE IT: `void` attaches no handler,
  // so the rejection still goes unhandled. Await it, catch it, or return it.
  {
    files: ['packages/*/src/**/*.ts'],
    // Tests live outside the package tsconfigs (they are excluded from the
    // build), so the project service cannot type them. They are also the one
    // place an unhandled rejection is loud rather than silent: vitest fails the
    // run. `tsconfig.tests.json` still typechecks them.
    ignores: ['**/*.test.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },

  // 3. The bin is a script, not a module: it talks to the user on stdout.
  {
    files: [
      'packages/cli/src/bin/*.ts',
      'packages/cli/src/**/*.ts',
      'scripts/**/*.mjs',
    ],
    rules: { 'no-console': 'off' },
  },

  eslintConfigPrettier,
  globalIgnores([
    'packages/*/dist/**',
    // Local end-to-end scratch: real audio, real transcripts, throwaway scripts.
    // Git-ignored, but ESLint's flat config does NOT read .gitignore, so `eslint .`
    // walks in and lints it as if it were source.
    'tmp-e2e/**',
    // Generated from the published OpenAPI document — `npm run typegen` owns it.
    'packages/sdk/src/generated/**',
  ]),
]);

export default eslintConfig;
