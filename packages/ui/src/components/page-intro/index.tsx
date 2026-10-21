import type { ReactNode } from 'react';

import { cn, tv, type VariantProps } from '#lib/tv';

/**
 * The title and the sentence under it, on the screens that explain rather
 * than list: install, sign in, permissions, a sheet. Each size keeps the gap
 * the mockups put between the title and its text.
 */
export const pageIntroVariants = tv({
  slots: {
    root: 'flex flex-col',
    title: 'font-bold text-ink',
    text: 'text-muted',
  },
  variants: {
    size: {
      xl: { title: 'text-32', text: 'mt-1.5' },
      lg: { title: 'text-28', text: 'mt-3' },
      md: { title: 'text-26', text: 'mt-[9px]' },
      sm: { title: 'text-22', text: 'mt-2.5' },
    },
    align: {
      /** A form or a list follows: text set like the body, 15 px. */
      start: { text: 'text-15 leading-[1.4]' },
      /** Alone under a picture: larger and centred, with a narrower measure. */
      center: {
        root: 'items-center text-center',
        text: 'px-[11px] text-16 leading-[23px]',
      },
    },
  },
  defaultVariants: { size: 'xl', align: 'start' },
});

export type PageIntroProps = VariantProps<typeof pageIntroVariants> & {
  title: ReactNode;
  description?: ReactNode;
  /** `h1` on a screen, `h2` inside a sheet. */
  as?: 'h1' | 'h2';
  className?: string;
};

export function PageIntro({
  title,
  description,
  size,
  align,
  as: Heading = 'h1',
  className,
}: PageIntroProps) {
  const styles = pageIntroVariants({ size, align });
  return (
    <header className={styles.root({ class: className })}>
      <Heading className={styles.title()}>{title}</Heading>
      {description && <p className={cn(styles.text())}>{description}</p>}
    </header>
  );
}
