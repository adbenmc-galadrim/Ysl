import { cn } from '#lib/tv';

/** A signature or a photo of a handover, as this iPhone keeps it. */
export type ProofMediaItem = {
  kind: 'signature' | 'photo';
  src: string;
  alt: string;
  onOpen?: () => void;
};

export type ProofMediaProps = {
  items?: ProofMediaItem[];
  className?: string;
};

/**
 * The proofs of a handover, shown: the signature on its white card, ink on
 * paper in either theme, and the photo as a thumbnail that opens full
 * screen. Taken on another iPhone, they never reach this one (D8): the
 * screen's details say where they are.
 */
export function ProofMedia({ items = [], className }: ProofMediaProps) {
  if (!items.length) return null;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {items.map((item) =>
            item.kind === 'signature' ? (
              <button
                key={item.src}
                type="button"
                onClick={item.onOpen}
                disabled={!item.onOpen}
                aria-label={item.alt}
                className="flex h-16 w-40 items-center justify-center overflow-hidden rounded-[10px] border border-separator bg-white px-2 outline-none focus-visible:ring-2 focus-visible:ring-blue enabled:cursor-zoom-in"
              >
                <img
                  src={item.src}
                  alt=""
                  draggable={false}
                  className="max-h-full max-w-full object-contain"
                />
              </button>
            ) : (
              <button
                key={item.src}
                type="button"
                onClick={item.onOpen}
                disabled={!item.onOpen}
                aria-label={item.alt}
                className="size-16 overflow-hidden rounded-[10px] bg-fill outline-none focus-visible:ring-2 focus-visible:ring-blue enabled:cursor-zoom-in"
              >
                <img
                  src={item.src}
                  alt=""
                  draggable={false}
                  className="size-full object-cover"
                />
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
