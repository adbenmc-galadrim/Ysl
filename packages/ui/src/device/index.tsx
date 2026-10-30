import type { ReactNode } from 'react';

import { cn } from '#lib/tv';

/**
 * The iOS chrome the mockups are drawn with. None of it ships in the app —
 * iOS paints its own status bar and home indicator over an installed PWA —
 * but drawing it in Storybook is what lets a screen be compared to its
 * Penpot frame pixel for pixel.
 */
export type DeviceTone = 'light' | 'dark';

export function StatusBar({ tone = 'light' }: { tone?: DeviceTone }) {
  const ink = tone === 'dark' ? 'bg-white' : 'bg-ink';
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 z-50 h-[50px]',
        tone === 'dark' ? 'text-white' : 'text-ink',
      )}
    >
      <span className="absolute top-[15px] left-[34px] text-16 font-semibold">
        9:41
      </span>
      {[5, 7, 9, 11].map((h, i) => (
        <span
          key={h}
          className={cn('absolute w-[3px]', ink)}
          style={{ right: 87 - i * 5, top: 31 - h, height: h }}
        />
      ))}
      <span
        className={cn(
          'absolute top-[20px] right-[34px] h-[11px] w-[24px] rounded-[3px] border',
          tone === 'dark' ? 'border-white' : 'border-ink',
        )}
      />
      <span
        className={cn(
          'absolute top-[22px] right-[38px] h-[7px] w-[18px] rounded-[1px]',
          ink,
        )}
      />
    </div>
  );
}

export function HomeIndicator({ tone = 'light' }: { tone?: DeviceTone }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute bottom-[4px] left-1/2 z-50 h-[5px] w-[134px] -translate-x-1/2 rounded-[3px]',
        tone === 'dark' ? 'bg-white' : 'bg-ink',
      )}
    />
  );
}

/**
 * A phone-sized viewport. It owns the safe-area variables, so the screen
 * inside lays out exactly as it would under the real notch.
 */
export function Device({
  tone = 'light',
  children,
}: {
  tone?: DeviceTone;
  children: ReactNode;
}) {
  return (
    <div className="device relative h-dvh w-full overflow-hidden">
      {children}
      <StatusBar tone={tone} />
      <HomeIndicator tone={tone} />
    </div>
  );
}
