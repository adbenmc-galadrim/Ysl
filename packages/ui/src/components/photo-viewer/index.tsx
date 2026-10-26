import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';

import { IconButton } from '#components/icon-button';
import {
  clampView,
  doubleTapView,
  fitSize,
  pinchView,
  RESTING,
  type Point,
  type Size,
  type View,
} from '#components/photo-viewer/zoom';
import { usePageLock } from '#lib/page-lock';
import { cn } from '#lib/tv';

export type PhotoViewerProps = {
  src: string;
  /** Describes the photo for VoiceOver. */
  alt: string;
  onClose: () => void;
  closeLabel?: string;
  className?: string;
};

type Gesture =
  | { kind: 'pan'; start: View; from: Point }
  | { kind: 'pinch'; start: View; from: { a: Point; b: Point } };

/** Two taps closer than this, in time and in place, are a double tap. */
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 30;
/** A finger that moved less than this between down and up tapped. */
const TAP_SLOP = 8;

/**
 * The label photo over the whole screen, on black: two fingers pinch it up
 * to four times, one finger moves it once zoomed, a double tap zooms into
 * the spot or back out. The page under it does not move while it is open.
 */
export function PhotoViewer({
  src,
  alt,
  onClose,
  closeLabel = 'Fermer',
  className,
}: PhotoViewerProps) {
  usePageLock(true);
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Size>({ width: 0, height: 0 });
  const [natural, setNatural] = useState<Size>({ width: 0, height: 0 });
  const [view, setView] = useState<View>(RESTING);
  const [settling, setSettling] = useState(false);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const tap = useRef<{ down: Point; moved: boolean }>({
    down: { x: 0, y: 0 },
    moved: false,
  });
  const lastTap = useRef<{ at: number; point: Point } | null>(null);
  const picture = fitSize(natural, frame);

  useLayoutEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const measure = () =>
      setFrame({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fromCentre = (event: PointerEvent<HTMLElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - box.left - box.width / 2,
      y: event.clientY - box.top - box.height / 2,
    };
  };

  const begin = (current: View) => {
    const [a, b] = [...pointers.current.values()];
    if (a && b)
      gesture.current = { kind: 'pinch', start: current, from: { a, b } };
    else if (a) gesture.current = { kind: 'pan', start: current, from: a };
    else gesture.current = null;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = fromCentre(event);
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 1)
      tap.current = { down: point, moved: false };
    else tap.current.moved = true;
    setSettling(false);
    begin(view);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    const point = fromCentre(event);
    pointers.current.set(event.pointerId, point);
    const current = gesture.current;
    if (!current) return;
    if (
      Math.abs(point.x - tap.current.down.x) > TAP_SLOP ||
      Math.abs(point.y - tap.current.down.y) > TAP_SLOP
    ) {
      tap.current.moved = true;
    }
    if (current.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      setView(pinchView(current.start, current.from, { a, b }));
    } else if (current.start.scale > 1) {
      setView(
        clampView(
          {
            ...current.start,
            x: current.start.x + point.x - current.from.x,
            y: current.start.y + point.y - current.from.y,
          },
          frame,
          picture,
        ),
      );
    }
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    const settled = clampView(view, frame, picture);
    if (pointers.current.size > 0) {
      begin(settled);
      return;
    }
    gesture.current = null;
    setSettling(true);
    if (!tap.current.moved) {
      const point = tap.current.down;
      const previous = lastTap.current;
      if (
        previous &&
        event.timeStamp - previous.at < DOUBLE_TAP_MS &&
        Math.abs(point.x - previous.point.x) < DOUBLE_TAP_PX &&
        Math.abs(point.y - previous.point.y) < DOUBLE_TAP_PX
      ) {
        lastTap.current = null;
        setView(clampView(doubleTapView(view, point), frame, picture));
        return;
      }
      lastTap.current = { at: event.timeStamp, point };
    }
    setView(settled);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className={cn(
        'fixed inset-0 z-[60] touch-none overscroll-none bg-black select-none',
        className,
      )}
    >
      <div
        ref={frameRef}
        data-testid="photo-viewer-frame"
        className="absolute inset-x-0 top-[calc(var(--safe-top)+60px)] bottom-[calc(var(--safe-bottom)+16px)] overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={(event) =>
            setNatural({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
          className={cn(
            'absolute top-1/2 left-1/2 max-w-none',
            settling && 'transition-transform duration-200 ease-out',
          )}
          style={{
            width: picture.width || undefined,
            height: picture.height || undefined,
            transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
        />
      </div>
      <IconButton
        icon="x"
        label={closeLabel}
        variant="night"
        size="lg"
        iconSize={22}
        onClick={onClose}
        className="absolute top-[calc(var(--safe-top)+8px)] left-[18px] bg-white/15"
      />
    </div>
  );
}
