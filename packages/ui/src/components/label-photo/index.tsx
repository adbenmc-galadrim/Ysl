import { Barcode } from '#components/parcel-label';
import { cn } from '#lib/tv';

export type LabelPhotoProps = {
  /** Describes the photo for VoiceOver. */
  alt?: string;
  className?: string;
};

/**
 * Stand-in for the photo of a shipping label taken at the scan: kraft board,
 * a paper label, address lines and a barcode. The app shows the real photo;
 * the mockups, and so the stories, draw this one.
 */
export function LabelPhoto({
  alt = 'Photo de l’étiquette',
  className,
}: LabelPhotoProps) {
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        'flex h-[148px] items-center justify-center overflow-hidden rounded-control bg-kraft',
        className,
      )}
    >
      <div className="flex h-[118.4px] w-[261.2px] shrink-0 flex-col items-start rounded-[1px] bg-paper pt-[8.3px] pl-[20.9px]">
        <span className="h-[4.7px] w-[104.5px] bg-black/85" />
        <span className="mt-[4.8px] h-[3px] w-[156.7px] bg-black/45" />
        <span className="mt-[18.3px] h-[4.7px] w-[130.6px] bg-black/85" />
        <span className="mt-[4.7px] h-[3px] w-[182.8px] bg-black/60" />
        {/* The camera's barcode, so the record shows the label that was
            scanned. */}
        <Barcode height={33.2} className="mt-[17.2px]" />
      </div>
    </div>
  );
}
