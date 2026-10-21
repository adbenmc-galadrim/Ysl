import { cn, tv, type VariantProps } from '#lib/tv';

export const avatarVariants = tv({
  base: 'relative inline-flex shrink-0 items-center justify-center rounded-tile font-semibold select-none',
  variants: {
    tone: {
      /** An agent's account, a person picked in a choice. */
      ink: 'bg-black text-white',
      /** A person in a directory list. */
      fill: 'bg-fill text-ink',
      /** A recipient inside a grey option card, where `fill` would vanish. */
      white: 'bg-white text-ink',
    },
    size: {
      /** 28: the agent column of the desktop table. */
      sm: 'size-7 rounded-tile-sm text-11',
      /** 40: a list row, beside a 17 px name. */
      md: 'size-10 text-15',
      /** 44: the account row of the settings. */
      lg: 'size-11 text-16',
      /** 56: the person a screen is about, beside a 26 px name. */
      xl: 'size-14 text-18',
    },
  },
  defaultVariants: { tone: 'ink', size: 'md' },
});

/** "Nora Haddad" → "NH"; at most two letters. */
export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export type AvatarProps = VariantProps<typeof avatarVariants> & {
  /** Shown as is; computed from `name` when left out. */
  initials?: string;
  name?: string;
  /** A presence dot on the corner: the agent is connected now, or not. */
  status?: 'online' | 'offline';
  className?: string;
};

/**
 * A person as initials in a square. The directory the app syncs carries no
 * photos, and the square matches the parcel tiles so people and parcels
 * line up in the same column.
 */
export function Avatar({
  initials,
  name = '',
  tone,
  size,
  status,
  className,
}: AvatarProps) {
  return (
    <span className={avatarVariants({ tone, size, class: className })}>
      <span aria-hidden="true">{initials ?? initialsOf(name)}</span>
      {status && (
        <span
          role="img"
          aria-label={status === 'online' ? 'En ligne' : 'Hors ligne'}
          className={cn(
            // The white ring cuts the dot out of the square, so it overhangs
            // the corner by 2 px like an iOS badge.
            'absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white',
            status === 'online' ? 'bg-ios-green' : 'bg-faint',
          )}
        />
      )}
    </span>
  );
}
