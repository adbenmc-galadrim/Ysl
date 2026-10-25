import type { ReactNode, Ref } from 'react';

type AppShellProps = {
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
};

/**
 * The frame of the installed app: exactly the visible viewport, never
 * scrolled; every screen scrolls inside itself.
 *
 * `dvh` is the one height that matches what iOS shows. Under an opaque status
 * bar (an icon added before the bar turned translucent) the viewport starts
 * below the bar and is 68 px shorter than the screen, while `lvh` and `svh`
 * keep the full screen height and push the bottom bar off screen. The
 * document keeps the full screen height on its own (`styles.css`).
 */
export function AppShell({ children, ref }: AppShellProps) {
  return (
    <div
      ref={ref}
      data-shell="app"
      className="flex h-dvh flex-col overflow-hidden"
    >
      {children}
    </div>
  );
}
