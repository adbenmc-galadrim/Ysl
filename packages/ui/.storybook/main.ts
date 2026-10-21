import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.@(mdx|stories.tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  core: { disableTelemetry: true },
  // The package has no `vite.config.ts` of its own, so Tailwind is wired in
  // here — it is only ever needed to render the previews.
  async viteFinal(viteConfig) {
    const { default: tailwindcss } = await import('@tailwindcss/vite');
    return mergeConfig(viteConfig, { plugins: [tailwindcss()] });
  },
};

export default config;
