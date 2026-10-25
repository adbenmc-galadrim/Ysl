/**
 * Keeps `theme-color` on the colour of the canvas, which follows the screen
 * on show (`styles.css`): the system paints its bars with it, dark over the
 * camera, light elsewhere.
 */
export function followThemeColor(app: HTMLElement): () => void {
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
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
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}
