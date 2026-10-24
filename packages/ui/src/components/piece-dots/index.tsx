import { cn } from '#lib/tv';

export type PieceDotsProps = {
  /** How many pieces the parcel is made of. */
  total: number;
  /** The pieces read so far: their 1-based numbers, or how many from the first. */
  read: number | readonly number[];
  className?: string;
};

/** The numbers of the pieces read, whichever way they were given. */
export function readPieces(
  read: number | readonly number[],
  total: number,
): Set<number> {
  if (typeof read === 'number') {
    return new Set(
      Array.from({ length: Math.min(read, total) }, (_, i) => i + 1),
    );
  }
  return new Set(read.filter((n) => n >= 1 && n <= total));
}

/**
 * One numbered dot per piece of a multi-piece parcel, green once read. The
 * dots are numbered rather than plain so the agent can say "the 3rd one is
 * missing" without counting. Drawn for the camera, so on a dark surface.
 */
export function PieceDots({ total, read, className }: PieceDotsProps) {
  const done = readPieces(read, total);
  const count = done.size;
  return (
    <ol
      aria-label={`${count} pièce${count > 1 ? 's' : ''} lue${count > 1 ? 's' : ''} sur ${total}`}
      className={cn('flex shrink-0 gap-1.5', className)}
    >
      {Array.from({ length: total }, (_, i) => (
        <li
          key={i}
          className={cn(
            'flex size-5 items-center justify-center rounded-full text-11 font-bold',
            done.has(i + 1)
              ? 'bg-ios-green-dark text-black'
              : 'border-2 border-ios-grey text-night-muted',
          )}
        >
          {i + 1}
        </li>
      ))}
    </ol>
  );
}
