import type { CSSProperties, ReactNode } from 'react';

import { AppMark } from '#components/app-mark';
import { cn } from '#lib/tv';

/*
 * The drawings of the landing page: the parcel in the viewfinder, the
 * phones of the install guide, the QR codes. They are pictures, not
 * interface, so every one is `aria-hidden` and keeps the exact geometry of
 * its Penpot layer — a table of numbers reads better here than flex boxes.
 */

type Box = { x: number; y: number; w: number; h: number };

const box = ({ x, y, w, h }: Box): CSSProperties => ({
  left: x,
  top: y,
  width: w,
  height: h,
});

/* -------------------------------------------------------------------------- */
/* Shipping label and the scene the camera films                              */
/* -------------------------------------------------------------------------- */

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

/**
 * The room the camera films: a parcel on a desk, its barcode just read. The
 * room is bright on purpose — the page is white and the picture dissolves
 * into it at the bottom, with no frame between the two. On the phone the
 * room runs edge to edge whatever the width; what is in it keeps the 390 px
 * stage of the mockup, centred.
 */
export function ScanScene({
  size,
  className,
}: {
  size: Size;
  className?: string;
}) {
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

/** The check in a green disc, used on the read card and the photos. */
export function CheckDisc({
  size,
  d,
  stroke,
  className,
}: {
  size: number;
  d: string;
  stroke: number;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={cn('shrink-0', className)}
    >
      <circle cx={size / 2} cy={size / 2} r={size / 2} className="fill-ios-green" />
      <path
        d={d}
        className="fill-none stroke-white"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Parcel pictures                                                            */
/* -------------------------------------------------------------------------- */

const KRAFT = {
  kraft: 'bg-kraft',
  mid: 'bg-kraft-mid',
  light: 'bg-kraft-light',
  deep: 'bg-kraft-deep',
  dark: 'bg-kraft-dark',
} as const;

export type KraftTone = keyof typeof KRAFT;

/** A list thumbnail: a square of kraft with its paper label. */
export function ParcelThumb({
  size,
  tone,
  className,
}: {
  size: 40 | 44;
  tone: KraftTone;
  className?: string;
}) {
  const small = size === 40;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative block shrink-0',
        small ? 'size-10 rounded-[9px]' : 'size-11 rounded-[10px]',
        KRAFT[tone],
        className,
      )}
    >
      <span
        className={cn(
          'absolute rounded-[2px] bg-paper',
          small ? 'top-2.5 left-2 h-4 w-6' : 'top-2.5 left-[9px] h-[18px] w-[26px]',
        )}
      />
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* QR codes                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The 25 × 25 modules of the install QR, finder patterns left out: they are
 * drawn rounded, on top. Rows read top to bottom, `#` is a dark module.
 */
const QR_MATRIX = [
  '..........###.#..........',
  '........##..#.#.#........',
  '..........##..##.........',
  '........##..##.##........',
  '.........##.###.#........',
  '..........#.#..##........',
  '........####...##........',
  '.........#.####.#........',
  '#........#####..#.##.##.#',
  '..##..###....#.####...#.#',
  '#.####.###.###.##.#.#...#',
  '##.#####.##...##.....#..#',
  '........##...#...#..###..',
  '#.##.##..###.#.#..#.###..',
  '##.##.###.#..######..#.##',
  '#..#...#..####...####....',
  '#.#...##..##.....####...#',
  '.........##.######....###',
  '.........##..#...##.##.##',
  '........##...##......##.#',
  '.........##..#..######...',
  '.........###########.#...',
  '........#.##.#.##.#.##..#',
  '.........##.#####.##.#.#.',
  '........#..#...###...##.#',
];

/**
 * The install QR: rounded modules and finders, the app mark in its centre.
 * Every measure is a share of the side, so one drawing serves the four
 * sizes of the page.
 */
export function InstallQr({
  size,
  radius,
  className,
}: {
  size: number;
  radius: number;
  className?: string;
}) {
  const margin = size * 0.08;
  const pitch = (size * 0.84) / 25;
  const finders: [number, number][] = [
    [0, 0],
    [18, 0],
    [0, 18],
  ];
  return (
    <span
      aria-hidden="true"
      className={cn('relative block shrink-0 bg-white', className)}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 size-full">
        <g className="fill-black">
          {QR_MATRIX.flatMap((row, y) =>
            [...row].map((cell, x) =>
              cell === '#' ? (
                <rect
                  key={`${x}-${y}`}
                  x={margin + x * pitch}
                  y={margin + y * pitch}
                  width={pitch * 0.92}
                  height={pitch * 0.92}
                  rx={pitch * 0.25}
                />
              ) : null,
            ),
          )}
        </g>
        {finders.map(([fx, fy]) => {
          const x = margin + fx * pitch;
          const y = margin + fy * pitch;
          return (
            <g key={`${fx}-${fy}`}>
              <rect x={x} y={y} width={pitch * 7} height={pitch * 7} rx={pitch * 1.4} className="fill-black" />
              <rect x={x + pitch} y={y + pitch} width={pitch * 5} height={pitch * 5} rx={pitch} className="fill-white" />
              <rect x={x + pitch * 2} y={y + pitch * 2} width={pitch * 3} height={pitch * 3} rx={pitch * 0.7} className="fill-black" />
            </g>
          );
        })}
      </svg>
      {/* Centred on the code, like the logo of a branded QR. */}
      <span className="absolute" style={{ left: size * 0.4, top: size * 0.4 }}>
        <AppMark size={size * 0.2} edge="halo" />
      </span>
    </span>
  );
}

/** Modules of the small pickup code on the phone: a 7 px grid, 8 px pitch. */
const PICKUP_MODULES: [number, number][] = [
  [48, 12], [56, 20], [48, 28], [64, 36], [48, 48], [56, 56], [72, 48],
  [88, 56], [96, 48], [48, 64], [64, 72], [80, 80], [96, 88], [72, 96],
  [48, 96], [88, 104], [56, 88], [104, 72], [48, 80], [64, 104], [12, 48],
  [28, 56], [20, 64],
];

/** The pickup code the employee scans, as drawn on the phone layout. */
export function PickupQr({ className }: { className?: string }) {
  const finders: [number, number][] = [
    [10, 10],
    [78, 10],
    [10, 78],
  ];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 118 118"
      width={118}
      height={118}
      className={cn('shrink-0 rounded-[14px] bg-white', className)}
    >
      {finders.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width={30} height={30} rx={6} className="fill-black" />
          <rect x={x + 6} y={y + 6} width={18} height={18} rx={3} className="fill-white" />
          <rect x={x + 10} y={y + 10} width={10} height={10} rx={2} className="fill-black" />
        </g>
      ))}
      {PICKUP_MODULES.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={7} height={7} rx={1.5} className="fill-black" />
      ))}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Icons drawn in the mockups                                                 */
/* -------------------------------------------------------------------------- */

const PLANE = {
  24: 'M12,0L15,10L24,14L24,18L15,15L14,22L17,25L17,27L12,26L7,27L7,25L10,22L9,15L0,18L0,14L9,10Z',
  28: 'M14,0L17.5,12L28,17L28,21.5L17.5,18L16.5,26L20,29.5L20,32L14,30.5L8,32L8,29.5L11.5,26L10.5,18L0,21.5L0,17L10.5,12Z',
  16: 'M8,0L10,7L16,10L16,12.5L10,10.5L9.5,15L11.5,17L11.5,18.5L8,17.5L4.5,18.5L4.5,17L6.5,15L6,10.5L0,12.5L0,10L6,7Z',
} as const;

const PLANE_BOX = { 24: [24, 27], 28: [28, 32], 16: [16, 18.5] } as const;

/** The flight-mode plane, at the three sizes the page draws it. */
export function Plane({
  size,
  className,
}: {
  size: keyof typeof PLANE;
  className?: string;
}) {
  const [w, h] = PLANE_BOX[size];
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={className}>
      <path d={PLANE[size]} />
    </svg>
  );
}

/** Mail's icon: a blue gradient square with a white envelope. */
export function MailIcon({ size }: { size: 38 | 40 }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center bg-linear-to-b from-site-mail to-site-mail-2',
        size === 38 ? 'size-[38px] rounded-[9px]' : 'size-10 rounded-[10px]',
      )}
    >
      <svg
        viewBox="0 0 20 16"
        width={20}
        height={16}
        className="overflow-visible fill-none stroke-white"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M0,0L20,0L20,16L0,16ZM0,0L10,8L20,0" />
      </svg>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* The phones of the install guide                                            */
/* -------------------------------------------------------------------------- */

function PhoneFrame({
  screen,
  children,
}: {
  screen: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className="relative h-[270px] w-[156px] shrink-0 rounded-[30px] bg-site-fill-2"
    >
      <div
        className={cn(
          'absolute top-[5px] left-[5px] h-[260px] w-[146px] overflow-hidden rounded-[25px]',
          screen,
        )}
      >
        {children}
        <span className="absolute top-2 left-12 h-3.5 w-[50px] rounded-[7px] bg-black" />
      </div>
    </div>
  );
}

/** Step 1: a page in Safari, its Partager button lit. */
export function SafariPhone() {
  return (
    <PhoneFrame screen="bg-white">
      <span className="absolute top-10 left-3.5 h-3 w-[90px] rounded-[3px] bg-night" />
      {[60, 74, 88, 102].map((y, i) => (
        <span
          key={y}
          className={cn(
            'absolute left-3.5 h-[7px] rounded-[3px] bg-separator',
            i % 2 ? 'w-[100px]' : 'w-[118px]',
          )}
          style={{ top: y }}
        />
      ))}
      <span className="absolute top-[120px] left-3.5 h-[60px] w-[118px] rounded-[8px] bg-fill" />
      <div className="absolute inset-x-0 top-[206px] h-[54px] bg-sidebar">
        <span className="absolute top-1.5 left-2.5 h-5 w-[126px] rounded-[7px] bg-separator" />
        <span className="absolute top-6 left-[55px] size-9 rounded-full bg-ios-blue/15" />
        <svg
          viewBox="0 0 12 18"
          width={12}
          height={18}
          className="absolute top-[30px] left-[67px] overflow-visible fill-none stroke-ios-blue"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6,0L6,13M1,5L6,0L11,5M0,8L0,18L12,18L12,8" />
        </svg>
      </div>
    </PhoneFrame>
  );
}

/** Step 2: Safari's share sheet, on « Sur l’écran d’accueil ». */
export function ShareSheetPhone() {
  return (
    <PhoneFrame screen="bg-muted">
      <div className="absolute inset-x-0 top-[92px] h-[168px] rounded-[16px] bg-fill">
        <span className="absolute top-1.5 left-[58px] h-1 w-[30px] rounded-[2px] bg-faint" />
        <div className="absolute top-5 left-2 h-[108px] w-[130px] overflow-hidden rounded-[10px] bg-white text-[10px] leading-3">
          <span className="absolute top-[11px] left-2.5 text-black">Copier</span>
          <span className="absolute top-[35px] left-2.5 h-px w-[120px] bg-separator" />
          <span className="absolute inset-x-0 top-9 h-9 bg-ios-blue/12" />
          <span className="absolute top-[47px] left-2.5 font-semibold text-ios-blue">
            Sur l’écran d’accueil
          </span>
          <span className="absolute top-[46px] left-[108px] size-3.5 rounded-[3px] ring-[1.4px] ring-ios-blue ring-inset" />
          <svg
            viewBox="0 0 7 7"
            width={7}
            height={7}
            className="absolute top-[49.5px] left-[111.5px] overflow-visible fill-none stroke-ios-blue"
            strokeWidth={1.4}
            strokeLinecap="round"
          >
            <path d="M3.5,0L3.5,7M0,3.5L7,3.5" />
          </svg>
          <span className="absolute top-[71px] left-2.5 h-px w-[120px] bg-separator" />
          <span className="absolute top-[83px] left-2.5 text-black">Liste de lecture</span>
        </div>
      </div>
    </PhoneFrame>
  );
}

const HOME_ICONS = [
  [14, 40, 'bg-ios-green/90'],
  [45, 40, 'bg-site-blue/90'],
  [76, 40, 'bg-ios-orange-light/90'],
  [107, 40, 'bg-ios-red-light/90'],
  [14, 84, 'bg-site-purple/90'],
  [76, 84, 'bg-site-yellow/90'],
  [107, 84, 'bg-ios-green/90'],
] as const;

const DOCK_ICONS = ['bg-ios-green', 'bg-site-blue', 'bg-white', 'bg-ios-orange-light'];

/** Step 3: the home screen, Courrier among the apps. */
export function HomeScreenPhone() {
  return (
    <PhoneFrame screen="bg-linear-to-br from-site-wallpaper to-site-wallpaper-2">
      {HOME_ICONS.map(([x, y, tone]) => (
        <span
          key={`${x}-${y}`}
          className={cn('absolute size-[26px] rounded-[6.5px]', tone)}
          style={{ left: x, top: y }}
        />
      ))}
      <span className="absolute top-[81px] left-[42px] size-8 rounded-[9px] ring-[1.5px] ring-white ring-inset" />
      <AppMark size={26} className="absolute top-[84px] left-[45px]" />
      <span className="absolute top-[113px] left-[39px] w-[38px] text-center text-[6.5px] leading-2 font-semibold text-white">
        Courrier
      </span>
      <div className="absolute top-[208px] left-2 flex h-11 w-[130px] gap-1 rounded-[16px] bg-black/11 pt-[9px] pl-2.5">
        {DOCK_ICONS.map((tone) => (
          <span key={tone} className={cn('size-[26px] rounded-[6.5px]', tone)} />
        ))}
      </div>
    </PhoneFrame>
  );
}

const LIST_PARCELS = [
  { name: 'Camille Roux', meta: 'Comptabilité · 10 h 15', tone: 'kraft', status: 'bg-site-blue' },
  { name: 'Hugo Bernard', meta: 'Juridique · il y a 2 h', tone: 'mid', status: 'bg-ios-orange-light' },
  { name: 'Léa Martin', meta: 'Presse · 9 h 40', tone: 'light', status: 'bg-ios-green' },
  { name: 'Nora Petit', meta: 'Studio · 8 h 55', tone: 'deep', status: 'bg-site-blue' },
  { name: 'Inès Garnier', meta: 'RH · hier', tone: 'dark', status: 'bg-ios-orange-light' },
] as const;

/** The parcel list of the app, on the phone that floats over the hero. */
export function ParcelListPhone({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative h-[470px] w-[230px] rounded-[40px] bg-site-fill-2 shadow-site-phone ring-1 ring-black/6 ring-inset',
        className,
      )}
    >
      <div className="absolute top-[9px] left-[9px] h-[452px] w-[212px] overflow-hidden rounded-[31px] bg-white px-[18px]">
        <span className="absolute top-2.5 left-[61px] h-[26px] w-[90px] rounded-[13px] bg-black" />
        <p className="absolute top-4 left-7 text-15 leading-[18px] font-semibold text-site-ink">
          9:41
        </p>
        <p className="mt-[58px] text-30 leading-9 font-bold text-site-ink">Colis</p>
        <p className="mt-1 text-13 leading-4 text-site-muted">Aujourd’hui · 12 colis</p>
        <ul className="mt-2.5">
          {LIST_PARCELS.map((p) => (
            <li key={p.name} className="relative flex h-16 w-44 gap-3 pt-2.5">
              <ParcelThumb size={44} tone={p.tone} />
              <div className="pt-0.5">
                <p className="text-16 leading-5 font-semibold text-site-ink">{p.name}</p>
                <p className="mt-0.5 text-13 leading-4 whitespace-nowrap text-site-muted">
                  {p.meta}
                </p>
              </div>
              <span className={cn('absolute top-[27px] left-[166px] size-2.5 rounded-full', p.status)} />
              <span className="absolute top-[63px] left-14 h-px w-[120px] bg-separator" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
