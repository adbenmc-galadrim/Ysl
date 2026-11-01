import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import type { IconName } from '#icons';

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
