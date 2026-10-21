import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import turboPlugin from 'eslint-plugin-turbo';
import tseslint from 'typescript-eslint';

/**
 * A shared ESLint configuration for the repository.
 *
 * Order matters in a flat config: everything type-aware has to be configured
 * before the `disableTypeChecked` block below, or it comes back on for the
 * plain-JS files that have no program to answer it.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  // Type-aware, not just syntactic: in a codebase where drizzle, tRPC and
  // Better Auth all return promises, `no-floating-promises` and
  // `no-misused-promises` are the rules worth paying a type-check for. The
  // `no-unsafe-*` half of the preset comes with them, and earns its keep by
  // catching the spots where inference has quietly collapsed to `any`.
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // Resolves each file through the nearest tsconfig, so packages need no
        // per-package wiring. `lint` runs from the package root, which is what
        // makes `process.cwd()` the right anchor.
        projectService: true,
        tsconfigRootDir: process.cwd(),
      },
    },
    rules: {
      // A drizzle query builder is a thenable, not a `Promise`, so the rule
      // walks straight past a dropped one without this — which would leave out
      // the half of the codebase the rule was turned on for.
      '@typescript-eslint/no-floating-promises': [
        'error',
        { checkThenables: true },
      ],
    },
  },
  {
    // Config files and other plain JS have no program to check them against.
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      'turbo/no-undeclared-env-vars': 'warn',
    },
  },
  {
    ignores: ['dist/**'],
  },
];
