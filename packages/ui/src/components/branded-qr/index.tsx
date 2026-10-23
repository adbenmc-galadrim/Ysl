import type { ReactNode } from 'react';

import { cn } from '#lib/tv';
import { QR_LOGO, QR_MARGIN, encodeQr, qrLogoArea } from '#lib/qr';

export type BrandedQrProps = {
  /** What the code carries, e.g. the public URL of the app. */
  value: string;
  /** Side of the white board, in px. */
  size: number;
  /** Corner radius of the board, in px. */
  radius?: number;
  /** Drawn in the centre, over a fifth of the side, on cleared modules. */
  logo?: ReactNode;
  /** Accessible text; without it the code is decorative. */
  label?: string;
  className?: string;
};

const FINDER = 7;

function inFinder(x: number, y: number, size: number) {
  const near = (v: number) => v < FINDER;
  const far = (v: number) => v >= size - FINDER;
  return (near(x) && near(y)) || (far(x) && near(y)) || (near(x) && far(y));
}

/**
 * A real QR code drawn the way the mockups draw it: rounded modules and
 * finders on a white board, the app mark in its centre. Every measure is a
 * share of the side, so one drawing serves every size of the page.
 */
export function BrandedQr({
  value,
  size,
  radius = 0,
  logo,
  label,
  className,
}: BrandedQrProps) {
  const matrix = encodeQr(value);
  const count = matrix.length;
  const margin = size * QR_MARGIN;
  const pitch = (size - 2 * margin) / count;
  const [from, to] = logo ? qrLogoArea(count) : [0, 0];
  const cleared = (x: number, y: number) =>
    x >= from && x < to && y >= from && y < to;
  const finders: [number, number][] = [
    [0, 0],
    [count - FINDER, 0],
    [0, count - FINDER],
  ];
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('relative block shrink-0 bg-white', className)}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 size-full"
      >
        <g className="fill-black">
          {matrix.flatMap((row, y) =>
            [...row].map((cell, x) =>
              cell === '#' && !inFinder(x, y, count) && !cleared(x, y) ? (
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
              <rect
                x={x}
                y={y}
                width={pitch * 7}
                height={pitch * 7}
                rx={pitch * 1.4}
                className="fill-black"
              />
              <rect
                x={x + pitch}
                y={y + pitch}
                width={pitch * 5}
                height={pitch * 5}
                rx={pitch}
                className="fill-white"
              />
              <rect
                x={x + pitch * 2}
                y={y + pitch * 2}
                width={pitch * 3}
                height={pitch * 3}
                rx={pitch * 0.7}
                className="fill-black"
              />
            </g>
          );
        })}
      </svg>
      {logo ? (
        <span
          className="absolute flex items-center justify-center"
          style={{
            left: size * (0.5 - QR_LOGO / 2),
            top: size * (0.5 - QR_LOGO / 2),
            width: size * QR_LOGO,
            height: size * QR_LOGO,
          }}
        >
          {logo}
        </span>
      ) : null}
    </span>
  );
}
