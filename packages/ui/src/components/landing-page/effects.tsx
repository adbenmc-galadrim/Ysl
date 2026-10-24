import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type MotionValue,
} from 'motion/react';
import {
  useRef,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';

import { cn } from '#lib/tv';

/*
 * Light effects of the landing page. Everything that moves is a transform or
 * an opacity; nothing blurs or filters while scrolling, so Safari iOS keeps
 * its frame rate.
 */

/** Layered shadow: a top highlight, a contact shadow, then two soft falloffs. */
export const RELIEF =
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_2px_rgba(20,24,40,0.06),0_10px_20px_-10px_rgba(20,24,40,0.12),0_32px_60px_-28px_rgba(20,24,40,0.22)]';

/* -------------------------------------------------------------------------- */
/* Dot / grid pattern                                                         */
/* -------------------------------------------------------------------------- */

const FADE =
  'radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 75%)';

export function DotPattern({
  className,
  size = 22,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage:
          'radial-gradient(rgba(24,32,56,0.2) 1.1px, transparent 1.3px)',
        backgroundSize: `${size}px ${size}px`,
        maskImage: FADE,
        WebkitMaskImage: FADE,
      }}
    />
  );
}

export function GridPattern({
  className,
  size = 48,
}: {
  className?: string;
  size?: number;
}) {
  const line = 'rgba(24,32,56,0.07)';
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
        maskImage: FADE,
        WebkitMaskImage: FADE,
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Border beam                                                                */
/* -------------------------------------------------------------------------- */

const RING_MASK: CSSProperties = {
  padding: 1.5,
  mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
  WebkitMask:
    'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
  maskComposite: 'exclude',
  WebkitMaskComposite: 'xor',
};

/**
 * A light that circles the edge of its parent (`relative`, rounded). A square
 * holding a conic gradient turns behind a ring-shaped mask; the turning is a
 * transform, the mask never changes.
 */
export function BorderBeam({
  radius,
  duration = 7,
  delay = 0,
  from = '#4f8cff',
  to = '#ffb24a',
  span = 'w-[190%]',
}: {
  radius: number;
  duration?: number;
  delay?: number;
  from?: string;
  to?: string;
  /** Width of the turning square, relative to the card. */
  span?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: '120px' });
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ borderRadius: radius, ...RING_MASK }}
    >
      <motion.div
        className={cn(
          'absolute top-1/2 left-1/2 aspect-square -translate-x-1/2 -translate-y-1/2',
          span,
        )}
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, transparent 280deg, ${from} 320deg, ${to} 350deg, transparent 360deg)`,
          opacity: reduce ? 0.55 : 1,
        }}
        animate={reduce || !visible ? undefined : { rotate: 360 }}
        transition={{
          duration,
          delay: -delay,
          ease: 'linear',
          repeat: Infinity,
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shimmer button                                                             */
/* -------------------------------------------------------------------------- */

export function ShimmerLink({
  href,
  className,
  children,
  label,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.a
      href={href}
      aria-label={label}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'group relative isolate inline-flex items-center justify-center overflow-hidden rounded-full bg-linear-to-b from-[#2b2f3a] to-site-ink font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.5),0_1px_2px_rgba(20,24,40,0.3),0_12px_24px_-10px_rgba(20,24,40,0.55)]',
        className,
      )}
    >
      <span className="relative z-10">{children}</span>
      {!reduce && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 z-0 w-1/3 -skew-x-[20deg] bg-linear-to-r from-white/0 via-white/35 to-white/0"
          initial={{ x: '-160%' }}
          animate={{ x: '420%' }}
          transition={{
            duration: 1.6,
            ease: 'easeInOut',
            repeat: Infinity,
            repeatDelay: 3.2,
          }}
        />
      )}
    </motion.a>
  );
}

/* -------------------------------------------------------------------------- */
/* Spotlight following the pointer                                            */
/* -------------------------------------------------------------------------- */

export function useSpotlight() {
  const x = useMotionValue(-1000);
  const y = useMotionValue(-1000);
  const sx = useSpring(x, { stiffness: 140, damping: 24, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 140, damping: 24, mass: 0.6 });
  const reduce = useReducedMotion();
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const box = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX - box.left - 320);
    y.set(e.clientY - box.top - 320);
  };
  return { x: sx, y: sy, onPointerMove };
}

export function Spotlight({
  x,
  y,
}: {
  x: MotionValue<number>;
  y: MotionValue<number>;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden overflow-hidden xl:block"
    >
      <motion.div
        className="absolute top-0 left-0 size-[640px] rounded-full"
        style={{
          x,
          y,
          background:
            'radial-gradient(circle, rgba(255,214,150,0.55) 0%, rgba(255,236,205,0.28) 35%, rgba(255,255,255,0) 68%)',
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pointer tilt                                                               */
/* -------------------------------------------------------------------------- */

export function Tilt({
  children,
  className,
  max = 6,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const reduce = useReducedMotion();
  const rx = useSpring(0, { stiffness: 160, damping: 20 });
  const ry = useSpring(0, { stiffness: 160, damping: 20 });
  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const b = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - b.left) / b.width - 0.5) * 2 * max);
    rx.set(-((e.clientY - b.top) / b.height - 0.5) * 2 * max);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
  };
  return (
    <motion.div
      className={className}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1100 }}
    >
      {children}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Reveal                                                                     */
/* -------------------------------------------------------------------------- */

export function Rise({
  children,
  className,
  delay = 0,
  y = 22,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
