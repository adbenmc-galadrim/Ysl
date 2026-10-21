import type { ReactNode } from 'react';

import { Button } from '#components/button';
import { IconButton } from '#components/icon-button';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

export type CameraTopBarProps = {
  /** The dark pill in the middle: "Lot : 12 colis", "QR code du retrait". */
  title?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  /** Shows the torch square; `onTorch` toggles it. */
  torch?: boolean;
  /**
   * `pill` sets the title in a dark chip, legible over any picture; `text`
   * is plain white, over a dark scene with nothing behind the bar.
   */
  titleStyle?: 'pill' | 'text';
  onTorch?: () => void;
  className?: string;
};

/**
 * Close, what is being scanned, torch. Dark squares rather than bare icons
 * because the picture under them can be anything, white walls included.
 */
export function CameraTopBar({
  title,
  onClose,
  closeLabel = 'Fermer',
  torch = true,
  titleStyle = 'pill',
  onTorch,
  className,
}: CameraTopBarProps) {
  return (
    <div
      className={cn(
        'grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center px-5',
        className,
      )}
    >
      <div className="flex">
        <IconButton
          icon="x"
          label={closeLabel}
          variant="night"
          size="lg"
          onClick={onClose}
        />
      </div>
      {title && titleStyle === 'text' ? (
        <span className="text-17 font-semibold whitespace-nowrap">{title}</span>
      ) : title ? (
        <span className="flex h-9 items-center rounded-chip bg-night px-3.5 text-15 font-semibold whitespace-nowrap">
          {title}
        </span>
      ) : (
        <span />
      )}
      <div className="flex justify-end">
        {torch && (
          <IconButton
            icon="torch"
            label="Lampe"
            variant="night"
            size="lg"
            onClick={onTorch}
          />
        )}
      </div>
    </div>
  );
}

/** The white disc in a white ring: take the photo when the reading fails. */
export function ShutterButton({
  label = 'Prendre la photo',
  onClick,
  className,
}: {
  label?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex size-[76px] shrink-0 cursor-pointer items-center justify-center rounded-full border-4 border-white outline-none',
        'focus-visible:ring-2 focus-visible:ring-ios-blue focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        className,
      )}
    >
      <span className="size-[60px] rounded-full bg-white transition-transform active:scale-90" />
    </button>
  );
}

export type CameraControlsProps = {
  /** Parcels read so far; the button opens their list. */
  count?: number;
  onOpenList?: () => void;
  onShutter?: () => void;
  doneLabel?: string;
  onDone?: () => void;
  /**
   * The two squares above the shutter row, against the screen edges:
   * import from the gallery, type the number.
   */
  tools?: { start?: ReactNode; end?: ReactNode };
  className?: string;
};

/**
 * The bottom of a scanning screen: the batch so far on the left, the shutter
 * in the middle, the way out on the right — the white button, because ending
 * the batch is the one thing to find without looking.
 */
export function CameraControls({
  count,
  onOpenList,
  onShutter,
  doneLabel = 'Terminer',
  onDone,
  tools,
  className,
}: CameraControlsProps) {
  return (
    <div className={cn('flex shrink-0 flex-col px-5', className)}>
      {tools && (
        <div className="flex h-11 justify-between">
          {tools.start ?? <span />}
          {tools.end ?? <span />}
        </div>
      )}
      <div
        className={cn(
          'grid grid-cols-[104px_1fr_104px] items-center',
          tools && 'mt-[22px]',
        )}
      >
        {count === undefined ? (
          <span />
        ) : (
          <button
            type="button"
            onClick={onOpenList}
            aria-label={`${count} colis lus, voir la liste`}
            className="flex h-[52px] cursor-pointer items-center gap-2 rounded-button bg-night pl-[18px] text-16 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ios-blue"
          >
            <Icon name="list" size={20} />
            <span className="w-10 text-center">{count}</span>
          </button>
        )}
        <ShutterButton onClick={onShutter} className="justify-self-center" />
        <Button
          variant="light"
          onClick={onDone}
          // Penpot's label box sits 1.5 px above the middle.
          className="w-[104px] px-0 pb-[3px] text-16"
        >
          {doneLabel}
        </Button>
      </div>
    </div>
  );
}

/** A 44 px dark square for the tools row: gallery, keyboard. */
export function CameraTool({
  icon,
  label,
  onClick,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
}) {
  return (
    <IconButton
      icon={icon}
      label={label}
      variant="night"
      size="lg"
      onClick={onClick}
    />
  );
}
