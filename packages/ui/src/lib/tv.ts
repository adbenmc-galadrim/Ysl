/**
 * Single entry point for variant styling, so components never import
 * `tailwind-variants` directly.
 *
 * `tailwind-merge` is taught the custom scales declared in `styles.css`:
 * without it, `text-17` reads as a colour and a later `text-muted` would
 * silently drop the font size.
 */
import {
  cnMerge,
  createTV,
  type CnOptions,
  type TWMConfig,
} from 'tailwind-variants';

const config: TWMConfig = {
  twMergeConfig: {
    extend: {
      theme: {
        text: [
          '11',
          '12',
          '13',
          '14',
          '15',
          '16',
          '17',
          '18',
          '20',
          '22',
          '24',
          '26',
          '28',
          '30',
          '32',
          '34',
        ],
        radius: [
          'tag',
          'chip',
          'control',
          'card',
          'sheet',
          'tile-sm',
          'tile',
          'tile-lg',
        ],
      },
    },
  },
};

export const tv = createTV(config);

export const cn = <T extends CnOptions>(...classes: T) =>
  cnMerge(...classes)(config);

export { cx, type VariantProps } from 'tailwind-variants';
