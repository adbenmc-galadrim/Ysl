import { config } from '@repo/eslint-config/react-internal';
import storybook from 'eslint-plugin-storybook';

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  ...storybook.configs['flat/recommended'],
  // The static site `build-storybook` emits.
  { ignores: ['storybook-static/**'] },
  {
    // `.storybook/` sits outside the alias root and keeps its relative import.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.',
              message: 'Use the # alias, even between siblings.',
            },
          ],
        },
      ],
    },
  },
];
