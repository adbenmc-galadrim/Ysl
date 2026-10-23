import type { ReactNode } from 'react';

import { AppMark } from '#components/app-mark';
import { ParcelThumb } from '#components/parcel-thumb';
import { cn } from '#lib/tv';

/*
 * The drawings of the landing page: the phones of the install guide and
 * the QR codes. They are pictures, not interface, so every one is
 * `aria-hidden` and keeps the exact geometry of its Penpot layer — a table
 * of numbers reads better here than flex boxes.
 */

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
