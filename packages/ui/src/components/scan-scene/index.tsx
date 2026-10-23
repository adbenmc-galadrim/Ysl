import type { CSSProperties, ReactNode } from 'react';

import { CheckDisc } from '#components/check-disc';
import { cn } from '#lib/tv';

type Box = { x: number; y: number; w: number; h: number };

const box = ({ x, y, w, h }: Box): CSSProperties => ({
  left: x,
  top: y,
  width: w,
  height: h,
});

/**
 * Bars of a Code 128-looking barcode: the same pseudo-random rhythm Penpot
 * drew, so the picture stays identical at both sizes.
 */
function barcode(width: number): [number, number][] {
  const bars: [number, number][] = [];
  for (let x = 0, i = 0; x < width - 4; i++) {
    const w = (i * 3) % 4 === 0 ? 3 : (i * 7) % 5 === 0 ? 2 : 1;
    bars.push([x, w]);
    x += w + 2 + ((i * 5) % 3 === 0 ? 1 : 0);
  }
  return bars;
}

/** Label metrics, read off the phone (188 px) and desktop (222 px) layers. */
const LABEL = {
  phone: {
    w: 188, h: 176, pad: 12, logo: 30, logoRadius: 4, ups: [15, 20, 10],
    count: [150, 14, 9], shipTo: [52, 13, 7], name: [52, 23, 11],
    dept: [52, 37, 6.5], rule: 52, bars: [14, 62, 160, 56],
    digits: [14, 124, 8], rule2: 142, billing: [14, 152, 6.5],
  },
  desk: {
    w: 222, h: 206, pad: 14, logo: 36, logoRadius: 5, ups: [18, 24, 12],
    count: [180, 16, 10], shipTo: [62, 15, 8], name: [62, 27, 13],
    dept: [62, 44, 7.5], rule: 62, bars: [16, 74, 190, 66],
    digits: [16, 148, 9.5], rule2: 168, billing: [16, 180, 7.5],
  },
} as const;

type Size = keyof typeof LABEL;

function LabelText({
  at: [x, y, size],
  className,
  children,
}: {
  at: readonly [number, number, number];
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn('absolute leading-[1.2] whitespace-nowrap', className)}
      style={{ left: x, top: y, fontSize: size }}
    >
      {children}
    </span>
  );
}

function ShippingLabel({ size, x, y }: { size: Size; x: number; y: number }) {
  const m = LABEL[size];
  const [bx, by, bw, bh] = m.bars;
  const mono = 'font-mono font-medium tracking-[0.5px] text-label-line';
  return (
    <div
      className="absolute rounded-[4px] bg-paper shadow-site-label"
      style={box({ x, y, w: m.w, h: m.h })}
    >
      <span
        className="absolute bg-site-ups"
        style={{
          ...box({ x: m.pad, y: m.pad, w: m.logo, h: m.logo }),
          borderRadius: m.logoRadius,
        }}
      />
      <LabelText at={m.ups} className="font-label font-extrabold text-site-ups-gold">
        UPS
      </LabelText>
      <LabelText at={m.count} className="font-label font-extrabold text-label-ink-3">
        1 / 1
      </LabelText>
      <LabelText at={m.shipTo} className={mono}>
        SHIP TO
      </LabelText>
      <LabelText at={m.name} className="font-label font-extrabold text-black">
        CAMILLE ROUX
      </LabelText>
      <LabelText at={m.dept} className={cn(mono, 'text-site-label-ink')}>
        COMPTABILITÉ · 4E ÉTAGE
      </LabelText>
      <span
        className="absolute h-[1.5px] bg-label-ink"
        style={{ left: m.pad, right: m.pad, top: m.rule }}
      />
      <svg
        className="absolute fill-label-ink"
        style={box({ x: bx, y: by, w: bw, h: bh })}
        viewBox={`0 0 ${bw} ${bh}`}
      >
        {barcode(bw).map(([x, w]) => (
          <rect key={x} x={x} width={w} height={bh} />
        ))}
      </svg>
      <LabelText
        at={m.digits}
        className="font-mono font-semibold tracking-[0.5px] text-label-ink-2"
      >
        1Z E63 44W 04 9923 0622
      </LabelText>
      <span
        className="absolute h-px bg-label-rule"
        style={{ left: m.pad, right: m.pad, top: m.rule2 }}
      />
      <LabelText at={m.billing} className={mono}>
        BILLING: P/P&nbsp;&nbsp;&nbsp;WT 1.2 KG
      </LabelText>
    </div>
  );
}

/** Where everything sits in the viewfinder, phone and desktop. */
const SCENE = {
  phone: {
    w: 390, h: 800, wall: 470,
    shadow: { x: 70, y: 448, w: 250, h: 40, blur: 18 },
    box: { x: 75, y: 170, w: 240, h: 290 }, tape: [128, 30], label: [26, 34],
    detect: { x: 108, y: 260, w: 180, h: 66 }, detectStroke: 2.5, detectRadius: 8,
    badge: { x: 110, y: 247, w: 72, h: 22 }, badgeText: 'text-[11px] leading-[14px]',
    corners: [
      'M56,176L56,150C56,143.33,59.33,140,66,140L92,140',
      'M298,140L324,140C330.67,140,334,143.33,334,150L334,176',
      'M56,452L56,478C56,484.67,59.33,488,66,488L92,488',
      'M298,488L324,488C330.67,488,334,484.67,334,478L334,452',
    ],
    cornerStroke: 4,
  },
  desk: {
    w: 580, h: 640, wall: 400,
    shadow: { x: 170, y: 392, w: 300, h: 44, blur: 20 },
    box: { x: 175, y: 100, w: 290, h: 310 }, tape: [140, 34], label: [34, 40],
    detect: { x: 203, y: 204, w: 234, h: 84 }, detectStroke: 3, detectRadius: 10,
    badge: { x: 205, y: 190, w: 82, h: 24 }, badgeText: 'text-[12px] leading-[15px]',
    corners: [
      'M150,120L150,92C150,84,154,80,162,80L192,80',
      'M448,80L478,80C486,80,490,84,490,92L490,120',
      'M150,400L150,428C150,436,154,440,162,440L192,440',
      'M448,440L478,440C486,440,490,436,490,428L490,400',
    ],
    cornerStroke: 4.5,
  },
} as const;

/** The card that confirms a read, phone and desktop. */
const READ_CARD = {
  phone: {
    at: { x: 20, y: 520, w: 350, h: 68 },
    root: 'bg-white/86 pt-[15px] pr-3.5 pl-3.5',
    disc: 'mt-px',
    gap: 'gap-3',
    name: 'text-16 leading-5',
    meta: 'mt-0.5',
    counter: 'mt-[5px]',
    detail: 'Comptabilité · UPS',
  },
  desk: {
    at: { x: 160, y: 540, w: 396, h: 72 },
    root: 'bg-white/88 pt-4 pr-4 pl-4',
    disc: 'mt-0.5',
    gap: 'gap-3.5',
    name: 'text-17 leading-[21px]',
    meta: 'mt-[3px]',
    counter: 'mt-1.5',
    detail: 'Comptabilité · UPS · enregistré',
  },
} as const;

const CARD_CHECK = 'M10,18L16,24L27,12';

export type ScanSceneProps = {
  /** `phone` for the 390 px layout, `desk` for the desktop one. */
  size: Size;
  className?: string;
};

/**
 * The room the camera films: a parcel on a desk, its barcode just read. The
 * room is bright on purpose — the page is white and the picture dissolves
 * into it at the bottom, with no frame between the two. On the phone the
 * room runs edge to edge whatever the width; what is in it keeps the 390 px
 * stage of the mockup, centred.
 */
export function ScanScene({ size, className }: ScanSceneProps) {
  const s = SCENE[size];
  const card = READ_CARD[size];
  const phone = size === 'phone';
  return (
    <div
      aria-hidden="true"
      className={cn('relative overflow-hidden bg-site-room', className)}
      style={{ width: phone ? undefined : s.w, height: s.h }}
    >
      <div
        className="absolute inset-x-0 top-0 bg-linear-to-b from-site-wall to-site-wall-2"
        style={{ height: s.wall }}
      />
      <div
        className="absolute inset-x-0 bottom-0 bg-linear-to-b from-site-desk to-site-desk-2"
        style={{ top: s.wall }}
      />
      <div
        className="absolute inset-y-0 left-1/2 -translate-x-1/2"
        style={{ width: s.w }}
      >
        <span
          className="absolute rounded-[50%] bg-site-shadow/35"
          style={{ ...box(s.shadow), filter: `blur(${s.shadow.blur}px)` }}
        />
        <div
          className="absolute overflow-hidden rounded-[8px] bg-linear-to-br from-site-box-lit to-kraft-deep"
          style={box(s.box)}
        >
          <span
            className="absolute inset-x-0 bg-site-tape/55"
            style={{ top: s.tape[0], height: s.tape[1] }}
          />
          <ShippingLabel size={size} x={s.label[0]} y={s.label[1]} />
        </div>
        <span
          className="absolute border-ios-green bg-ios-green/12"
          style={{
            ...box(s.detect),
            borderWidth: s.detectStroke,
            borderRadius: s.detectRadius,
          }}
        />
        <span
          className={cn(
            'absolute flex items-start justify-center rounded-[12px] bg-ios-green font-bold text-site-green-deep',
            phone ? 'pt-1' : 'pt-[5px]',
            s.badgeText,
          )}
          style={box(s.badge)}
        >
          Code lu
        </span>
        <svg
          className="absolute inset-0 size-full fill-none stroke-site-ink"
          viewBox={`0 0 ${s.w} ${s.h}`}
          strokeWidth={s.cornerStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {s.corners.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      </div>
      {/* The room fades into the page: under the nav on the phone, and
          into white at the bottom where the headline starts. */}
      {phone && (
        <div className="absolute inset-x-0 top-0 h-[140px] bg-linear-to-b from-white/85 to-white/0" />
      )}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0',
          phone
            ? 'h-[370px] bg-linear-to-b from-white/0 via-white/90 via-45% to-white'
            : 'h-[260px] bg-linear-to-b from-white/0 to-white/92',
        )}
      />
      <div
        className="absolute inset-y-0 left-1/2 -translate-x-1/2"
        style={{ width: s.w }}
      >
        <span
          className={cn(
            'absolute flex h-8 w-32 items-center gap-1.5 rounded-full bg-white/82 pl-3.5 text-13 leading-4 font-semibold text-site-ink ring-1 ring-black/6 ring-inset',
            phone ? 'top-20 left-[131px]' : 'top-6 left-[226px]',
          )}
        >
          <span className="size-2 rounded-full bg-ios-red-light" />
          Lot · 12 colis
        </span>
        <div
          className={cn(
            'absolute flex rounded-[20px] ring-1 ring-black/10 ring-inset',
            card.root,
            card.gap,
          )}
          style={box(card.at)}
        >
          <CheckDisc size={36} d={CARD_CHECK} stroke={2.8} className={card.disc} />
          <div className="flex-1">
            <p className={cn('font-semibold text-site-ink', card.name)}>
              Camille Roux
            </p>
            <p className={cn('text-13 leading-4 text-site-muted', card.meta)}>
              {card.detail}
            </p>
          </div>
          <span
            className={cn(
              'flex h-7 w-[68px] items-center justify-center rounded-[14px] bg-black/6 text-13 leading-4 font-semibold text-site-ink',
              card.counter,
            )}
          >
            3 / 12
          </span>
        </div>
      </div>
    </div>
  );
}
