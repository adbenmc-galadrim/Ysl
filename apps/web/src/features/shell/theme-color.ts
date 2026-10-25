function themeColorMeta() {
  return document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
}

/**
 * Puts the theme's surface in `theme-color` at launch: `followThemeColor`
 * only starts once the app has rendered, and a dark iPhone would open the
 * app under white bars until then.
 */
export function paintThemeColor() {
  const meta = themeColorMeta();
  if (!meta) return;
  const probe = document.createElement('div');
  probe.style.background = 'var(--color-surface)';
  document.documentElement.append(probe);
  meta.content = getComputedStyle(probe).backgroundColor;
  probe.remove();
}

/**
 * The landing page outside the app frame is white whatever the theme
 * (`styles.css`): its bars too, even when launch painted them dark.
 */
export function paintSiteThemeColor() {
  const meta = themeColorMeta();
  if (meta) meta.content = '#ffffff';
}

/**
 * Keeps `theme-color` on the colour of the canvas, which follows the screen
 * on show (`styles.css`) and the theme: the system paints its bars with it,
 * dark over the camera and in the dark theme, light elsewhere.
 */
export function followThemeColor(app: HTMLElement): () => void {
  const meta = themeColorMeta();
  if (!meta) return () => undefined;
  let frame = 0;
  const sync = () => {
    frame = 0;
    const color = getComputedStyle(document.documentElement).backgroundColor;
    if (meta.content !== color) meta.content = color;
  };
  const schedule = () => {
    frame ||= requestAnimationFrame(sync);
  };
  sync();
  const observer = new MutationObserver(schedule);
  observer.observe(app, {
    childList: true,
    subtree: true,
    attributeFilter: ['data-tone'],
  });
  // The theme set in Réglages, and the system's when the app follows it.
  observer.observe(document.documentElement, {
    attributeFilter: ['data-theme'],
  });
  const system = matchMedia('(prefers-color-scheme: dark)');
  system.addEventListener('change', schedule);
  return () => {
    observer.disconnect();
    system.removeEventListener('change', schedule);
    cancelAnimationFrame(frame);
  };
}
