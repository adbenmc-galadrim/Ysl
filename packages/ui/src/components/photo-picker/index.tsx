import type { ReactNode } from 'react';

import { Icon } from '#icons';
import { cn } from '#lib/tv';

export type PhotoPickerProps = {
  /** The photos taken so far, as 104 px thumbnails. */
  children?: ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  className?: string;
};

/**
 * The photos attached to a record — a damaged box, a signed slip. The
 * camera tile comes first and stays put, so taking one more photo is always
 * the same tap, however many there already are.
 */
export function PhotoPicker({
  children,
  onAdd,
  addLabel = 'Prendre une photo',
  className,
}: PhotoPickerProps) {
  return (
    <div className={cn('flex flex-wrap gap-2.5', className)}>
      <button
        type="button"
        aria-label={addLabel}
        onClick={onAdd}
        className={cn(
          'flex size-[104px] shrink-0 cursor-pointer items-center justify-center rounded-control bg-fill text-ink',
          'outline-none focus-visible:ring-2 focus-visible:ring-blue active:brightness-95',
        )}
      >
        <Icon name="camera" size={28} />
      </button>
      {children}
    </div>
  );
}
