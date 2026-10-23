import { AppMark } from '#components/app-mark';
import { cn } from '#lib/tv';

/*
 * The QR codes of the landing page. They are pictures, not interface, so
 * every one is `aria-hidden` and keeps the exact geometry of its Penpot
 * layer — a table of numbers reads better here than flex boxes.
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
