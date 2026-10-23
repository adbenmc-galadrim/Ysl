import { cn } from '#lib/tv';

const KRAFT = {
  kraft: 'bg-kraft',
  mid: 'bg-kraft-mid',
  light: 'bg-kraft-light',
  deep: 'bg-kraft-deep',
  dark: 'bg-kraft-dark',
} as const;

export type KraftTone = keyof typeof KRAFT;

/** A list thumbnail: a square of kraft with its paper label. */
export function ParcelThumb({
  size,
  tone,
  className,
}: {
  size: 40 | 44;
  tone: KraftTone;
  className?: string;
}) {
  const small = size === 40;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative block shrink-0',
        small ? 'size-10 rounded-[9px]' : 'size-11 rounded-[10px]',
        KRAFT[tone],
        className,
      )}
    >
      <span
        className={cn(
          'absolute rounded-[2px] bg-paper',
          small ? 'top-2.5 left-2 h-4 w-6' : 'top-2.5 left-[9px] h-[18px] w-[26px]',
        )}
      />
    </span>
  );
}
