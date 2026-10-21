import { cn } from '#lib/tv';

export type AlphabetIndexProps = {
  /** Only the letters that have people: a letter that leads nowhere is noise. */
  letters: string[];
  onSelect?: (letter: string) => void;
  className?: string;
};

/**
 * The blue A–Z rail on the right edge of a long list. It is a scrubber, so it
 * is laid over the list by the screen rather than taking a column of it.
 */
export function AlphabetIndex({
  letters,
  onSelect,
  className,
}: AlphabetIndexProps) {
  return (
    <nav
      aria-label="Index alphabétique"
      className={cn('flex w-3.5 flex-col items-center gap-[9px]', className)}
    >
      {letters.map((letter) => (
        <button
          key={letter}
          type="button"
          onClick={() => onSelect?.(letter)}
          className="w-full cursor-pointer text-center text-11 font-semibold text-blue outline-none focus-visible:ring-2 focus-visible:ring-blue"
        >
          {letter}
        </button>
      ))}
    </nav>
  );
}
