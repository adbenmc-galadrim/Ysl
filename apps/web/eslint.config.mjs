import { config } from '@repo/eslint-config/react-internal';

const apiIsTypeOnly = {
  name: '@repo/api',
  allowTypeImports: true,
  message: 'Import type only: the browser must not bundle the routers.',
};

const serverEnvStaysOut = {
  name: '@repo/shared/env/server',
  message: 'The browser reads @repo/shared/env/web.',
};

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  { ignores: ['dist/**', '**/routeTree.gen.ts'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [apiIsTypeOnly, serverEnvStaysOut],
        },
      ],
      '@typescript-eslint/only-throw-error': [
        'error',
        {
          allow: [
            {
              from: 'package',
              package: '@tanstack/router-core',
              name: ['Redirect', 'NotFoundError'],
            },
          ],
        },
      ],
    },
  },
];
