import type { CSSProperties, ReactNode } from 'react';

import { Icon } from '#icons';
import { cn } from '#lib/tv';

/**
 * The parcel the camera films, drawn rather than photographed: a stock photo
 * would date the mockups and leak a real address. Every piece is an
 * illustration, so it positions its own shapes; the coordinates are Penpot's.
 */

/**
 * Bars of the tracking barcode as `[x, width]` on a 207 px strip. One fixed
 * pattern: it only has to read as a barcode — the same one `LabelThumb`
 * starts with, so the photo and its thumbnail look like one label.
 */
const BARS: [number, number][] = [
  [0, 2], [5.25, 1], [11.5, 1], [16, 2], [21.25, 3], [27.5, 1], [32, 1],
  [36.25, 3], [43.5, 1], [48, 1], [52.25, 2], [59.5, 1], [63, 2], [68.25, 3],
  [74.5, 2], [79, 1], [84.25, 2], [89.5, 1], [95, 1], [100.25, 2], [105.5, 3],
  [111, 1], [116.25, 1], [120.5, 3], [127, 1], [132.25, 1], [136.5, 2],
  [143, 1], [147.25, 2], [152.5, 3], [158, 2], [163.25, 1], [168.5, 2],
  [173, 1], [179.25, 1], [184.5, 2], [189, 3], [195.25, 1], [200.5, 1],
  [204, 3],
];

/** A 1D barcode; print does not stretch, so its width is fixed. */
export function Barcode({
  height = 66,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      width={207}
      height={height}
      viewBox={`0 0 207 ${height}`}
      className={cn('block shrink-0 fill-label-ink', className)}
    >
      {BARS.map(([x, w]) => (
        <rect key={x} x={x} y={0} width={w} height={height} />
      ))}
    </svg>
  );
}

/**
 * Filled cells of the 2D code, as `[column, row]` on a 7.315 px grid. It is
 * the carrier's routing code, not a scannable QR — the pickup QR of another
 * screen goes in the `code` slot instead.
 */
const CELLS: [number, number][] = [
  [0, 0], [0, 2], [0, 5], [0, 7], [1, 1], [1, 2], [1, 6], [1, 7],
  [3, 0], [3, 4], [3, 5], [4, 1], [4, 4], [4, 6],
  [5, 0], [5, 2], [5, 5], [5, 7], [6, 1], [6, 2], [6, 6], [6, 7],
];

/** The square routing code printed in the label's corner. */
export function RoutingCode({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 66.08 66.08"
      className={cn('block size-[66.08px] shrink-0', className)}
    >
      <rect
        x={0.75}
        y={0.75}
        width={64.58}
        height={64.58}
        fill="none"
        strokeWidth={1.5}
        className="stroke-label-ink"
      />
      {CELLS.map(([c, r]) => (
        <rect
          key={`${c}-${r}`}
          x={4.72 + c * 7.315}
          y={2.16 + r * 7.315}
          width={6.61}
          height={6.61}
          className="fill-label-ink"
        />
      ))}
    </svg>
  );
}

export type ParcelLabelProps = {
  /** Printed big in the corner: "UPS", "DHL", "Colissimo". */
  carrier: string;
  /** The name under "SHIP TO:", set in capitals as carriers print it. */
  recipient: string;
  /** Up to two address lines. */
  address?: string[];
  tracking: string;
  /** The square code in the corner; a QR code for a pickup slip. */
  code?: ReactNode;
  /** Caption over the name: "SHIP TO:", "DESTINATAIRE" on French mail. */
  recipientHeading?: string;
  /** Caption before the number: "TRACKING #:", "RECOMMANDÉ AVEC AR". */
  trackingHeading?: string;
  className?: string;
};

/**
 * A carrier's shipping label: carrier and routing code, the addressee, the
 * tracking number and its barcode. 236 × 300, the size it has on the parcel
 * the camera looks at.
 */
export function ParcelLabel({
  carrier,
  recipient,
  address = [],
  tracking,
  code = <RoutingCode />,
  recipientHeading = 'SHIP TO:',
  trackingHeading = 'TRACKING #:',
  className,
}: ParcelLabelProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex h-[300px] w-[236px] flex-col rounded-[2px] bg-paper font-label text-label-ink',
        className,
      )}
    >
      <div className="flex h-[102px] justify-between px-[14.16px] pt-3">
        <div className="flex flex-col">
          <span className="text-[17px]/5 font-extrabold">{carrier}</span>
          {/* Filler lines: the sender block, unreadable at that distance. */}
          <span className="mt-[7px] h-[4.8px] w-[99.12px] bg-label-line" />
          <span className="mt-[5.7px] h-[4.8px] w-[75.52px] bg-label-line" />
        </div>
        {code}
      </div>
      <div className="h-px bg-label-rule" />
      <div className="flex h-[77px] flex-col px-[14.5px] pt-2">
        <span className="text-[8px]/[10px] font-bold text-label-ink-2">
          {recipientHeading}
        </span>
        <span className="mt-[5px] text-[14px]/[17px] font-bold uppercase">
          {recipient}
        </span>
        {address.map((line) => (
          <span
            key={line}
            className="mt-1 text-[8px]/[10px] font-medium text-label-ink-3"
          >
            {line}
          </span>
        ))}
      </div>
      <div className="h-px bg-label-rule" />
      <span className="mt-2 px-[14.5px] text-[8px]/[10px] font-bold whitespace-pre">
        {trackingHeading} {tracking}
      </span>
      <Barcode className="mt-[11px] ml-[14.16px]" />
    </div>
  );
}

/**
 * The kraft side of the box, label centred on it, as the camera frames it.
 * The children are the label — or anything else stuck on a parcel.
 */
export function ParcelBox({
  children,
  tone = 'kraft',
  className,
}: {
  children: ReactNode;
  /** `envelope` for a letter: the same framing on grey-white paper. */
  tone?: 'kraft' | 'envelope';
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex h-[370px] w-[296px] justify-center rounded-[4px] pt-6',
        tone === 'kraft' ? 'bg-kraft-dark' : 'bg-envelope',
        className,
      )}
    >
      {children}
    </div>
  );
}

export type LabelZoomProps = {
  /** The caption printed before the name: "Destinataire :". */
  heading: string;
  /** The name as read, possibly cut short by the glare. */
  name: string;
  address?: string[];
  /**
   * A reflection over the end of the name: why the reading is uncertain.
   * Its left edge is in px from the label's text column.
   */
  glare?: { left: number; width: number };
  /** Bottom-right corner action, e.g. a zoom button. */
  action?: ReactNode;
  className?: string;
};

/**
 * The photo of the label, cropped to the line that needs a human eye. It is
 * the evidence next to the question "Pour qui est ce colis ?", so the agent
 * decides from the label and not from the app's guess.
 */
export function LabelZoom({
  heading,
  name,
  address = [],
  glare,
  action,
  className,
}: LabelZoomProps) {
  return (
    <div
      className={cn(
        'relative flex h-[170px] rounded-card bg-kraft pt-[18px] pr-[27px] pb-[18px] pl-[26px]',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="relative flex flex-1 flex-col rounded-[2px] bg-paper px-3.5 pt-3.5 font-label text-label-ink-3"
      >
        <span className="text-[12px]/[14px] font-bold">{heading}</span>
        <span className="mt-1.5 text-[26px]/[31px] font-bold text-label-ink-2">
          {name}
        </span>
        {glare && (
          <span
            className="absolute top-[34px] h-[30px] rounded-[calc(var(--radius-card)-3px)] bg-white/60"
            style={{ left: glare.left + 14, width: glare.width }}
          />
        )}
        {address.map((line, i) => (
          <span
            key={line}
            className={cn(
              'text-[11px]/[13px] font-medium',
              i ? 'mt-[5px]' : 'mt-[9px]',
            )}
          >
            {line}
          </span>
        ))}
      </div>
      {action && (
        <div className="absolute right-1.5 bottom-1.5 flex">{action}</div>
      )}
    </div>
  );
}

/** A region of a photo, in the photo's own pixels. */
export type PhotoRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LabelCropProps = {
  src: string;
  /** The photo's natural size. */
  width: number;
  height: number;
  /** The line to bring forward, e.g. where the recipient's name was read. */
  focus?: PhotoRegion | null;
  alt?: string;
  action?: ReactNode;
  className?: string;
};

/** How much wider than the line the crop shows, and the closest it zooms in. */
const FOCUS_MARGIN = 1.6;
const MIN_SHOWN = 0.35;

/**
 * The real photo of the label in `LabelZoom`'s frame: centred on the line
 * that needs a human eye, zoomed so it fills the width, or whole when no
 * line is known. Sized with container units, so no measuring in script.
 */
export function LabelCrop({
  src,
  width,
  height,
  focus,
  alt = 'Photo de l’étiquette',
  action,
  className,
}: LabelCropProps) {
  let style: CSSProperties = { inset: 0, width: '100%', height: '100%' };
  if (focus && width > 0) {
    const shown = Math.min(
      width,
      Math.max(focus.width * FOCUS_MARGIN, width * MIN_SHOWN),
    );
    const centreX = focus.x + focus.width / 2;
    const centreY = focus.y + focus.height / 2;
    const left = Math.min(Math.max(centreX - shown / 2, 0), width - shown);
    style = {
      width: `calc(100cqw * ${width / shown})`,
      maxWidth: 'none',
      left: `calc(-100cqw * ${left / shown})`,
      top: `calc(50cqh - 100cqw * ${centreY / shown})`,
    };
  }
  return (
    <div
      className={cn(
        'relative h-[170px] overflow-hidden rounded-card bg-kraft [container-type:size]',
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={cn('absolute', focus ? 'h-auto' : 'object-contain')}
        style={style}
      />
      {action && (
        <div className="absolute right-1.5 bottom-1.5 flex">{action}</div>
      )}
    </div>
  );
}

/** The white square button over the photo's corner that opens it full size. */
export function LabelZoomButton({
  label = 'Agrandir la photo',
  onClick,
}: {
  label?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 cursor-pointer items-center justify-center rounded-tile-sm bg-white text-black outline-none focus-visible:ring-2 focus-visible:ring-blue"
    >
      <Icon name="zoom" size={18} />
    </button>
  );
}
