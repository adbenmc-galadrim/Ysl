import { cn } from '#lib/tv';

export type PieceDotsProps = {
  /** How many pieces the parcel is made of. */
  total: number;
  /** How many of them have been read so far. */
  read: number;
  className?: string;
};

/**
 * One numbered dot per piece of a multi-piece parcel, green once read. The
 * dots are numbered rather than plain so the agent can say "the 3rd one is
 * missing" without counting. Drawn for the camera, so on a dark surface.
 */
export function PieceDots({ total, read, className }: PieceDotsProps) {
  return (
    <ol
      aria-label={`${read} pièce${read > 1 ? 's' : ''} lue${read > 1 ? 's' : ''} sur ${total}`}
      className={cn('flex shrink-0 gap-1.5', className)}
    >
      {Array.from({ length: total }, (_, i) => (
        <li
          key={i}
          className={cn(
            'flex size-5 items-center justify-center rounded-full text-11 font-bold',
            i < read
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
