import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

/** The bar of these screens: one 52 px action at y 764. */
export function PhoneAction({
  children,
  icon,
}: {
  children: ReactNode;
  icon?: IconName;
}) {
  return (
    <BottomBar surface="plain" className="pt-6 pb-9">
      <Button block icon={icon} iconSize={20} className="gap-2">
        {children}
      </Button>
    </BottomBar>
  );
}

/** The big green disc that closes a handover. */
export function DoneDisc() {
  return (
    <span className="mt-[92px] flex size-[88px] shrink-0 items-center justify-center self-center rounded-full bg-green-solid text-white">
      <Icon name="tick" size={44} />
    </span>
  );
}

/** The bordered card of what the handover secured. */
export function ProofCard({
  items,
}: {
  items: { icon: IconName; label: string }[];
}) {
  return (
    <ul className="mt-[30px] flex h-[150px] shrink-0 flex-col gap-6 rounded-[16px] border border-separator pt-[17px] pr-[19px] pl-[15px]">
      {items.map((item) => (
        <li key={item.label} className="flex h-[18px] items-center text-15">
          <Icon name={item.icon} size={18} className="shrink-0 text-ink-2" />
          <span className="ml-3 min-w-0 flex-1">{item.label}</span>
          <Icon name="tick" size={18} aria-label="Fait" className="relative top-px shrink-0 text-green" />
        </li>
      ))}
    </ul>
  );
}

const QR_MATRIX = [
  '#######.......#######',
  '#.....#..##...#.....#',
  '#.###.#.##....#.###.#',
  '#.###.#.##.#..#.###.#',
  '#.###.#..#....#.###.#',
  '#.....#...##..#.....#',
  '#######..#....#######',
  '.........#..#........',
  '...#.#######..#...#.#',
  '#.#######...##.####.#',
  '....####...##...#....',
  '###.#####....#..#.#..',
  '#.....#.#...#.#.####.',
  '.........####.######.',
  '#######.##...####..##',
  '#.....#.#..#.##.#.#.#',
  '#.###.#....##.####.##',
  '#.###.#....###.#####.',
  '#.###.#..#.##.#.#....',
  '#.....#...##.###.##.#',
  '#######..#...###..#.#',
];

/** The employee's phone held up to the camera: the QR of the e-mail, its code. */
export function EmployeePhone() {
  return (
    <div className="absolute top-[220px] left-[106px] h-[250px] w-[180px] rounded-[28px] bg-scene-phone p-2">
      <div className="relative h-full rounded-[22px] bg-white text-black">
        <svg
          aria-hidden="true"
          viewBox="0 0 21 21"
          className="absolute top-[34px] left-[22px] size-[120px] fill-black"
        >
          {QR_MATRIX.flatMap((line, y) =>
            [...line].map((cell, x) =>
              cell === '#' ? (
                <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />
              ) : null,
            ),
          )}
        </svg>
        <p className="absolute inset-x-0 top-[172px] text-center text-22 font-bold">
          4821
        </p>
      </div>
    </div>
  );
}

/** Four corners of two rounded bars, around the square the camera looks at. */
export function ScanCorners({
  x,
  y,
  size,
  color,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
}) {
  const bar = cn('absolute rounded-[2px]', color);
  return (
    <span aria-hidden="true" className="absolute" style={{ left: x, top: y, width: size, height: size }}>
      {[
        ['top-0 left-0', 'top-0 left-0'],
        ['top-0 right-0', 'top-0 right-0'],
        ['bottom-0 left-0', 'bottom-0 left-0'],
        ['bottom-0 right-0', 'bottom-0 right-0'],
      ].map(([h, v]) => (
        <span key={h}>
          <span className={cn(bar, 'h-1 w-8', h)} />
          <span className={cn(bar, 'h-8 w-1', v)} />
        </span>
      ))}
    </span>
  );
}

/** The still of the handover's camera: a wall, a counter, the dark status bar. */
export function CounterScene() {
  return (
    <>
      <div className="absolute inset-0 bg-scene-counter" />
      <div className="absolute inset-x-0 top-0 h-[520px] bg-scene" />
      <div className="absolute inset-x-0 top-0 h-[98px] bg-linear-to-b from-black from-50% to-transparent" />
    </>
  );
}
