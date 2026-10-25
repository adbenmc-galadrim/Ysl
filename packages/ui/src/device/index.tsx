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

/**
 * The browser window the desktop mockup is drawn in: macOS buttons and the
 * address bar over the page. Like `Device`, it exists so the desktop screen
 * can be compared with its Penpot frame; the app never draws it.
 */
export function BrowserWindow({
  url,
  children,
}: {
  url: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative flex h-dvh w-full flex-col overflow-hidden rounded-[12px] bg-white',
        // Penpot strokes the frame inside, over the page: an overlay rather
        // than a border, which would push the page 1 px in.
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-[12px] after:border after:border-border',
      )}
    >
      <div
        aria-hidden="true"
        className="relative flex h-9 shrink-0 items-center justify-center bg-fill"
      >
        <span className="absolute top-3 left-3.5 flex gap-1.5">
          <span className="size-3 rounded-full bg-mac-close" />
          <span className="size-3 rounded-full bg-mac-minimize" />
          <span className="size-3 rounded-full bg-mac-zoom" />
        </span>
        <span className="flex h-[22px] w-[440px] max-w-[50%] items-start justify-center rounded-[6px] bg-white pt-[3px] text-12 text-muted">
          {url}
        </span>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
