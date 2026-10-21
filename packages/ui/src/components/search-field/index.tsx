import type { ComponentProps } from 'react';

import { Icon } from '#icons';
import { tv, type VariantProps } from '#lib/tv';

/**
 * The grey search box, at the three heights the mockups use: 52 in the
 * thumb zone, 44 at the top of a list, 36 in the desktop toolbar.
 */
export const searchFieldVariants = tv({
  slots: {
    root: [
      'flex min-w-0 items-center bg-fill text-left text-muted',
      'outline-none focus-within:ring-2 focus-within:ring-blue focus-visible:ring-2 focus-visible:ring-blue',
    ],
    icon: 'shrink-0',
    input:
      'h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden',
  },
  variants: {
    size: {
      lg: { root: 'h-[52px] gap-2.5 rounded-control pl-4 text-17' },
      // Penpot sets the 44 px field's text 1.5 px above centre.
      md: {
        root: 'h-11 gap-[9px] rounded-control pl-[13px] text-16',
        input: 'pb-[3px]',
      },
      /** 48: the field a screen is about, under its title ("Qui retire ?"). */
      form: { root: 'h-12 gap-2.5 rounded-control pl-3.5 text-17' },
      sm: { root: 'h-9 gap-2 rounded-chip pl-3 text-14' },
      /** 44 at chip radius: the search screen's own field, beside "Annuler". */
      bar: {
        root: 'h-11 flex-1 gap-[9px] rounded-chip pr-[13px] pl-[15px] text-17',
      },
    },
  },
  defaultVariants: { size: 'lg' },
});

type SearchSize = NonNullable<VariantProps<typeof searchFieldVariants>['size']>;

const ICON: Record<SearchSize, { size: number; strokeWidth: number }> = {
  lg: { size: 20, strokeWidth: 2 },
  md: { size: 18, strokeWidth: 2.2 },
  form: { size: 20, strokeWidth: 2.2 },
  sm: { size: 16, strokeWidth: 2 },
  bar: { size: 18, strokeWidth: 2.2 },
};

/**
 * On the home screen the box is only a door to the search screen, so
 * `SearchTrigger` is a button that looks like the field rather than a field
 * that navigates on focus — which would pop the keyboard up for a screen
 * that is about to be replaced.
 */
export function SearchTrigger({
  label = 'Rechercher',
  size = 'lg',
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { label?: string; size?: SearchSize }) {
  const s = searchFieldVariants({ size });
  return (
    <button
      type={type}
      className={s.root({ class: ['flex-1 cursor-pointer', className] })}
      {...props}
    >
      <Icon name="search" {...ICON[size]} className={s.icon()} />
      <span className="truncate">{label}</span>
    </button>
  );
}

/**
 * The real field, for a list filtered in place (the directory): typing
 * narrows the rows under it, so there is no screen to go to.
 */
export function SearchField({
  size = 'md',
  className,
  placeholder = 'Rechercher',
  onClear,
  ...props
}: Omit<ComponentProps<'input'>, 'size'> & {
  size?: SearchSize;
  /** Shows a clear cross while there is a value; called when tapped. */
  onClear?: () => void;
}) {
  const s = searchFieldVariants({ size });
  return (
    <label className={s.root({ class: className })}>
      <Icon name="search" {...ICON[size]} className={s.icon()} />
      <input
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        className={s.input({ class: 'caret-blue' })}
        {...props}
      />
      {onClear && props.value !== undefined && props.value !== '' && (
        <button
          type="button"
          aria-label="Effacer"
          onClick={onClear}
          className="flex shrink-0 cursor-pointer text-muted outline-none focus-visible:ring-2 focus-visible:ring-blue"
        >
          <Icon name="x" size={14} strokeWidth={2.6} />
        </button>
      )}
    </label>
  );
}

