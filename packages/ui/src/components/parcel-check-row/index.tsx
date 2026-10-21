import type { ReactNode } from 'react';

import { CheckCircle } from '#components/checkbox';
import { LabelThumb } from '#components/label-thumb';
import { cn } from '#lib/tv';

export type ParcelCheckRowProps = {
  /** "Amazon ···4471": what is read off the label at the desk. */
  title: ReactNode;
  detail?: ReactNode;
  /** Orange for what changes the handover, e.g. a registered parcel. */
  detailTone?: 'muted' | 'orange';
  checked?: boolean;
  onToggle?: () => void;
  separator?: boolean;
  className?: string;
};

/**
 * A parcel about to be handed over, with the photo of its label so the
 * agent can match it to the box on the shelf. Every parcel starts checked:
 * unticking one is how a partial pickup is recorded.
 */
export function ParcelCheckRow({
  title,
  detail,
  detailTone = 'muted',
  checked = true,
  onToggle,
  separator = false,
  className,
}: ParcelCheckRowProps) {
  return (
    <div className={className}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue"
      >
        <LabelThumb size={44} />
        <span className="flex min-w-0 flex-1 flex-col self-start pt-[3px]">
          <span className="truncate text-17 font-semibold">{title}</span>
          {detail && (
            <span
              className={cn(
                'mt-[3px] truncate text-14',
                detailTone === 'orange' ? 'text-orange' : 'text-muted',
              )}
            >
              {detail}
            </span>
          )}
        </span>
        <CheckCircle checked={checked} />
      </button>
      {separator && <div className="mt-[9px] mb-2 ml-14 h-px bg-separator" />}
    </div>
  );
}
