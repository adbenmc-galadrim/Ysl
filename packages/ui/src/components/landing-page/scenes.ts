import { gsap } from 'gsap';

/*
 * One small scene per card. A scene gets the card's element, puts its parts
 * in their starting pose, and returns a paused timeline; `playScenes` plays
 * it, once, when the card is on screen. Only transform, opacity and
 * stroke-dashoffset move.
 *
 * The starting poses are set from here, never from the markup, so a page
 * that does not run the scenes (reduced motion) shows every card finished.
 * The exceptions are the parts that are only ever visible mid-gesture
 * (fingers, ripples, the plane): they are drawn transparent in the markup.
 */

type Tl = gsap.core.Timeline;
type Scene = (root: HTMLElement) => Tl;

const all = (root: ParentNode, selector: string) =>
  gsap.utils.toArray<HTMLElement>(selector, root);

/** Arms a stroke for drawing: hidden now, `strokeDashoffset: 0` reveals it. */
function arm(path: Element | null) {
  if (!(path instanceof SVGGeometryElement)) return;
  const length = path.getTotalLength();
  gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
}

/* ------------------------------ journey cards ------------------------------ */

/** Reçu: the photos land one by one, each with its check; the bar fills; 3 sur 12 counts. */
const batch: Scene = (root) => {
  const photos = all(root, '[data-photo]');
  const fill = all(root, '[data-fill]');
  const count = root.querySelector<HTMLElement>('[data-count]');
  const names = all(root, '[data-names]');
  const total = photos.length;
  const tl = gsap.timeline({ paused: true });

  gsap.set(photos, { opacity: 0 });
  gsap.set(fill, { scaleX: 0 });
  gsap.set(names, { opacity: 0, y: 6 });
  if (count) count.textContent = '0';

  photos.forEach((photo, i) => {
    const at = i * 0.6;
    const disc = photo.querySelector('svg');
    const stroke = photo.querySelector('svg path');
    gsap.set(photo, { y: -26, scale: 1.14, rotate: i % 2 ? 3 : -3 });
    gsap.set(disc, { scale: 0 });
    arm(stroke);
    tl.to(photo, { opacity: 1, duration: 0.16, ease: 'none' }, at)
      .to(
        photo,
        { y: 0, scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(1.7)' },
        at,
      )
      .to(disc, { scale: 1, duration: 0.35, ease: 'back.out(3)' }, at + 0.42)
      .to(
        stroke,
        { strokeDashoffset: 0, duration: 0.28, ease: 'power1.out' },
        at + 0.52,
      )
      .to(
        fill,
        { scaleX: (i + 1) / total, duration: 0.5, ease: 'power2.out' },
        at + 0.4,
      );
    if (count) {
      tl.call(
        () => {
          count.textContent = String(i + 1);
        },
        [],
        at + 0.42,
      ).fromTo(
        count,
        { y: -4, opacity: 0.2 },
        {
          y: 0,
          opacity: 1,
          duration: 0.3,
          ease: 'power2.out',
          immediateRender: false,
        },
        at + 0.42,
      );
    }
  });
  tl.to(
    names,
    { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
    total * 0.6 + 0.1,
  );
  return tl;
};

/** Notifié: the banner drops in from the top of the screen and settles with a small rebound. */
const notif: Scene = (root) => {
  const banner = all(root, '[data-banner]');
  const mail = all(root, '[data-mail]');
  const labels = all(root, '[data-device], [data-foot]');
  const tl = gsap.timeline({ paused: true });

  gsap.set(banner, { y: -54, opacity: 0, scale: 0.97 });
  gsap.set(labels, { opacity: 0 });

  tl.to(labels[0] ?? [], { opacity: 1, duration: 0.4 }, 0)
    .to(banner, { opacity: 1, duration: 0.2, ease: 'none' }, 0.12)
    .to(banner, { y: 0, scale: 1, duration: 0.85, ease: 'back.out(1.9)' }, 0.12)
    .to(
      mail,
      {
        scale: 1.14,
        duration: 0.14,
        yoyo: true,
        repeat: 1,
        ease: 'power1.out',
      },
      0.72,
    )
    .to(labels[1] ?? [], { opacity: 1, duration: 0.5 }, 0.8);
  return tl;
};

/** Remis: the code digits roll up to their value, the signature is traced, the pill lands. */
const handover: Scene = (root) => {
  const strips = all(root, '[data-strip]');
  const sigs = all(root, '[data-sig]');
  const pill = all(root, '[data-pill]');
  const ping = all(root, '[data-ping]');
  const tl = gsap.timeline({ paused: true });

  sigs.forEach(arm);
  gsap.set(pill, { opacity: 0, scale: 0.82, transformOrigin: '0% 50%' });

  strips.forEach((strip, i) => {
    const n = Number(strip.dataset.n ?? 1);
    gsap.set(strip, { yPercent: -((n - 1) / n) * 100 });
    tl.to(
      strip,
      { yPercent: 0, duration: 1.1 + i * 0.2, ease: 'power3.out' },
      i * 0.09,
    );
  });
  tl.to(
    sigs[0] ?? [],
    { strokeDashoffset: 0, duration: 0.95, ease: 'power1.inOut' },
    0.95,
  )
    .to(
      sigs[1] ?? [],
      { strokeDashoffset: 0, duration: 0.35, ease: 'power2.out' },
      1.85,
    )
    .to(
      pill,
      { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2.2)' },
      2.2,
    )
    .set(ping, { opacity: 0.55, scale: 1 }, 2.35)
    .to(
      ping,
      { opacity: 0, scale: 2.8, duration: 0.9, ease: 'power1.out', repeat: 1 },
      2.35,
    );
  return tl;
};

/* -------------------------------- hors ligne -------------------------------- */

/** Hors ligne: the plane crosses, then the parcels go from En attente to Synchronisé, one by one. */
const offline: Scene = (root) => {
  const flight = root.querySelector<HTMLElement>('[data-flight]');
  const flyer = all(root, '[data-flyer]');
  const trail = all(root, '[data-trail]');
  const queue = root.querySelector<HTMLElement>('[data-queue]');
  const tl = gsap.timeline({ paused: true });
  const wide = Boolean(queue && queue.offsetParent !== null);

  gsap.set(trail, { scaleX: 0 });
  tl.to(flyer, { opacity: 1, duration: 0.2, ease: 'none' }, 0)
    .to(trail, { opacity: 1, duration: 0.2, ease: 'none' }, 0)
    .fromTo(
      flyer,
      { x: -22 },
      {
        x: () => (flight?.clientWidth ?? 400) + 6,
        duration: 1.6,
        ease: 'power1.inOut',
        immediateRender: false,
      },
      0,
    )
    .to(trail, { scaleX: 1, duration: 1.6, ease: 'power1.inOut' }, 0)
    .to(flyer, { opacity: 0, duration: 0.2, ease: 'none' }, 1.45)
    .to(trail, { opacity: 0, duration: 0.5, ease: 'none' }, 1.5);

  if (wide) {
    all(root, '[data-row]').forEach((row, i) => {
      const pend = row.querySelector('[data-pend]');
      const done = row.querySelector('[data-done]');
      const disc = row.querySelector('[data-done] svg');
      const stroke = row.querySelector('[data-done] svg path');
      const at = 1.25 + i * 0.6;
      gsap.set(pend, { opacity: 1 });
      gsap.set(done, { opacity: 0, scale: 0.85 });
      gsap.set(disc, { scale: 0 });
      arm(stroke);
      tl.to(
        pend,
        { opacity: 0, scale: 0.9, duration: 0.22, ease: 'power1.in' },
        at,
      )
        .to(
          done,
          { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' },
          at + 0.1,
        )
        .to(disc, { scale: 1, duration: 0.3, ease: 'back.out(3)' }, at + 0.22)
        .to(
          stroke,
          { strokeDashoffset: 0, duration: 0.26, ease: 'power1.out' },
          at + 0.3,
        );
    });
  } else {
    const synced = all(root, '[data-synced]');
    const arrow = root.querySelector('[data-arrow]');
    const disc = root.querySelector('[data-synced] svg');
    const stroke = root.querySelector('[data-synced] svg path');
    arm(arrow);
    arm(stroke);
    gsap.set(synced, {
      opacity: 0,
      x: -10,
      scale: 0.92,
      transformOrigin: '0% 50%',
    });
    gsap.set(disc, { scale: 0 });
    tl.to(
      arrow,
      { strokeDashoffset: 0, duration: 0.4, ease: 'power1.out' },
      1.3,
    )
      .to(
        synced,
        { opacity: 1, x: 0, scale: 1, duration: 0.5, ease: 'back.out(2)' },
        1.6,
      )
      .to(disc, { scale: 1, duration: 0.3, ease: 'back.out(3)' }, 1.78)
      .to(
        stroke,
        { strokeDashoffset: 0, duration: 0.26, ease: 'power1.out' },
        1.86,
      );
  }
  return tl;
};

/* ---------------------------------- install --------------------------------- */

/** A finger comes down on a target and presses: the target answers with a ring. */
function tap(
  tl: Tl,
  finger: Element[],
  ripple: Element[],
  at: number,
  from: { x: number; y: number },
) {
  gsap.set(finger, { x: from.x, y: from.y, opacity: 0, scale: 1 });
  gsap.set(ripple, { opacity: 0 });
  tl.to(finger, { opacity: 1, duration: 0.25, ease: 'none' }, at)
    .to(finger, { x: 0, y: 0, duration: 0.6, ease: 'power2.out' }, at)
    .to(finger, { scale: 0.78, duration: 0.12, ease: 'power1.in' }, at + 0.65)
    .set(ripple, { opacity: 0.7, scale: 0.7 }, at + 0.74)
    .to(
      ripple,
      { scale: 2.2, opacity: 0, duration: 0.7, ease: 'power2.out' },
      at + 0.74,
    )
    .to(finger, { scale: 1, duration: 0.18, ease: 'power2.out' }, at + 0.8)
    .to(finger, { opacity: 0, duration: 0.3, ease: 'none' }, at + 1.05);
}

/** Step 1: the finger lands on Partager. */
const tapShare: Scene = (root) => {
  const tl = gsap.timeline({ paused: true });
  const bg = all(root, '[data-share-bg]');
  tap(tl, all(root, '[data-finger]'), all(root, '[data-ripple]'), 0, {
    x: 30,
    y: 36,
  });
  tl.to(
    bg,
    { scale: 1.22, duration: 0.16, yoyo: true, repeat: 1, ease: 'power1.out' },
    0.72,
  );
  return tl;
};

/** Step 2: the share sheet rises, then Sur l'écran d'accueil is picked. */
const tapSheet: Scene = (root) => {
  const tl = gsap.timeline({ paused: true });
  const sheet = all(root, '[data-sheet]');
  const hl = all(root, '[data-hl]');
  gsap.set(sheet, { y: 170 });
  gsap.set(hl, { scaleX: 0 });
  tl.to(sheet, { y: 0, duration: 0.85, ease: 'power3.out' }, 0).to(
    hl,
    { scaleX: 1, duration: 0.4, ease: 'power2.out' },
    0.8,
  );
  tap(tl, all(root, '[data-finger]'), all(root, '[data-ripple]'), 0.95, {
    x: 26,
    y: 34,
  });
  return tl;
};

/** Step 3: the home screen fills in, the app's icon drops into its place. */
const home: Scene = (root) => {
  const tl = gsap.timeline({ paused: true });
  const icons = all(root, '[data-home-icon]');
  const ring = all(root, '[data-app-ring]');
  const mark = all(root, '[data-app-mark]');
  const label = all(root, '[data-app-label]');
  const halo = all(root, '[data-app-halo]');
  gsap.set(icons, { opacity: 0, scale: 0.7 });
  gsap.set([ring, label], { opacity: 0 });
  gsap.set(mark, { opacity: 0, scale: 1.9, y: -16 });
  gsap.set(halo, { opacity: 0 });
  tl.to(
    icons,
    {
      opacity: 1,
      scale: 1,
      duration: 0.4,
      stagger: 0.045,
      ease: 'back.out(2)',
    },
    0,
  )
    .to(ring, { opacity: 1, duration: 0.25 }, 0.75)
    .to(mark, { opacity: 1, duration: 0.2, ease: 'none' }, 0.75)
    .to(mark, { scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.7)' }, 0.75)
    .set(halo, { opacity: 0.9, scale: 1 }, 1.2)
    .to(halo, { scale: 2, opacity: 0, duration: 0.65, ease: 'power2.out' }, 1.2)
    .to(label, { opacity: 1, duration: 0.4 }, 1.2);
  return tl;
};

/* ---------------------------------- closing --------------------------------- */

/** Closing: the QR is laid down module by module in a diagonal sweep, then read by a laser. */
const closing: Scene = (root) => {
  const tl = gsap.timeline({ paused: true });
  const qr = root.querySelector('[data-closing-qr]');
  const svg = qr?.querySelector('svg');
  const logo = qr?.querySelector('svg + span');
  const laser = all(root, '[data-laser]');
  if (!qr || !svg) return tl;

  const side = svg.viewBox.baseVal.width || 140;
  const modules = Array.from(
    svg.querySelectorAll<SVGGraphicsElement>('g.fill-black > rect'),
  );
  const finders = Array.from(
    svg.querySelectorAll<SVGGraphicsElement>(':scope > g:not(.fill-black)'),
  );
  const parts = [...modules, ...finders];
  gsap.set(parts, {
    opacity: 0,
    scale: 0.2,
    transformOrigin: '50% 50%',
    transformBox: 'fill-box',
  });
  gsap.set(logo ?? [], { opacity: 0, scale: 0.6 });
  parts.forEach((part, i) => {
    const b = part.getBBox();
    const sweep = (b.x + b.width / 2 + b.y + b.height / 2) / (2 * side);
    const jitter = ((i * 37) % 11) / 11;
    tl.to(
      part,
      { opacity: 1, scale: 1, duration: 0.32, ease: 'back.out(2)' },
      sweep * 1.15 + jitter * 0.1,
    );
  });
  tl.to(
    logo ?? [],
    { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' },
    1.3,
  )
    .to(laser, { opacity: 1, duration: 0.15, ease: 'none' }, 1.55)
    .fromTo(
      laser,
      { y: 2 },
      { y: 136, duration: 0.8, ease: 'power1.inOut', immediateRender: false },
      1.55,
    )
    .to(laser, { opacity: 0, duration: 0.2, ease: 'none' }, 2.2);
  return tl;
};

export const SCENES: Record<string, Scene> = {
  batch,
  notif,
  handover,
  offline,
  'tap-share': tapShare,
  'tap-sheet': tapSheet,
  home,
  closing,
};

/** Puts every scene of `root` in its starting pose, and plays each once when it is on screen. */
export function playScenes(root: HTMLElement, desk: boolean) {
  const timelines = new Map<Element, Tl>();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        timelines.get(entry.target)?.play();
      });
    },
    { threshold: 0.55, rootMargin: '0px 0px -6% 0px' },
  );
  all(root, '[data-scene]').forEach((el) => {
    const build = SCENES[el.dataset.scene ?? ''];
    if (!build || el.offsetParent === null) return;
    const tl = build(el);
    // The three phones play one after the other when they are side by side.
    if (el.dataset.index)
      tl.delay(desk ? 0.5 + Number(el.dataset.index) * 0.9 : 0.25);
    timelines.set(el, tl);
    // A page reloaded further down: the scenes already passed are shown finished.
    if (el.getBoundingClientRect().bottom < 0) tl.progress(1, false);
    else io.observe(el);
  });
  return () => {
    io.disconnect();
    all(root, '[data-count]').forEach((n) => {
      n.textContent = n.dataset.final ?? n.textContent;
    });
  };
}
