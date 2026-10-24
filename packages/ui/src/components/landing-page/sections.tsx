import { useEffect, useRef, useState, type ReactNode } from 'react';

import { AppBrand } from '#components/app-mark';
import {
  BatchCard,
  HandoverCard,
  NotificationCard,
} from '#components/landing-page/cards';
import { Glow } from '#components/glow';
import type { LandingCopy } from '#components/landing-page';
import {
  BorderBeam,
  DotPattern,
  GridPattern,
  ShimmerLink,
} from '#components/landing-page/effects';
import { ParcelThumb } from '#components/parcel-thumb';
import {
  HomeScreenPhone,
  SafariPhone,
  ShareSheetPhone,
} from '#components/phone-mockup';
import { Plane } from '#components/plane';
import {
  AppQr,
  CONTAINER,
  RELIEF_BODY,
  SectionHeading,
  Tick,
  WELL,
} from '#components/landing-page/shared';
import { cn } from '#lib/tv';

/* -------------------------------------------------------------------------- */
/* The journey                                                                */
/* -------------------------------------------------------------------------- */

type Step = {
  label: string;
  title: string;
  text: string;
  dot: string;
  ink: string;
  rail?: string;
  card: ReactNode;
};

function journeySteps(copy: LandingCopy['journey']): Step[] {
  return [
    {
      ...copy.received,
      dot: 'bg-site-blue',
      ink: 'text-site-blue-ink',
      rail: 'from-ios-blue to-ios-orange',
      card: <BatchCard copy={copy.batch} />,
    },
    {
      ...copy.notified,
      dot: 'bg-ios-orange-light',
      ink: 'text-site-orange-ink',
      rail: 'from-ios-orange to-ios-green-dark',
      card: <NotificationCard copy={copy.notification} />,
    },
    {
      ...copy.handedOver,
      dot: 'bg-ios-green',
      ink: 'text-site-green-ink',
      card: <HandoverCard copy={copy.handover} />,
    },
  ];
}

export function Journey({ copy }: { copy: LandingCopy['journey'] }) {
  return (
    <section id="parcours" className="relative mt-12 xl:mt-0">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -top-[46px] -z-10 h-[1346px] bg-[linear-gradient(to_bottom,var(--color-white),var(--color-site-fill)_14%,var(--color-site-fill)_86%,var(--color-white))] xl:top-0 xl:h-[1024px]"
      />
      <GridPattern className="-z-10 h-[1346px] xl:h-[1024px]" />
      <Glow
        x={230}
        y={44}
        w={260}
        h={220}
        alpha={0.1}
        sigma={90}
        className="text-site-blue xl:hidden"
      />
      <div className={cn(CONTAINER, 'relative')}>
        <Glow
          x={-20}
          y={220}
          w={380}
          h={260}
          alpha={0.08}
          sigma={110}
          className="hidden text-site-blue xl:block"
        />
        <Glow
          x={430}
          y={220}
          w={380}
          h={260}
          alpha={0.07}
          sigma={110}
          className="hidden text-ios-orange-light xl:block"
        />
        <Glow
          x={860}
          y={220}
          w={380}
          h={260}
          alpha={0.07}
          sigma={110}
          className="hidden text-ios-green xl:block"
        />
        <SectionHeading
          eyebrow={copy.eyebrow}
          title={copy.title}
          text={copy.text}
          titleClass="mt-[9px] w-[350px] text-34 leading-9 tracking-[-1px] xl:mt-3 xl:w-auto xl:text-[52px] xl:leading-[63px] xl:tracking-[-2px]"
          textClass="hidden xl:block"
        />
        <ol
          data-steps
          className="relative mt-[42px] flex flex-col gap-[58px] xl:mt-[59px] xl:grid xl:grid-cols-3 xl:gap-6"
        >
          {journeySteps(copy).map((step) => (
            <li key={step.label} data-step className="relative pl-11 xl:pl-0">
              {step.rail && (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute top-2 left-[15px] h-[calc(100%+58px)] w-0.5 rounded-full bg-black/8 xl:top-[13px] xl:left-3.5 xl:h-0.5 xl:w-[calc(100%+24px)]"
                  />
                  <span
                    aria-hidden="true"
                    data-rail
                    className={cn(
                      'absolute top-2 left-[15px] h-[calc(100%+58px)] w-0.5 origin-top rounded-full bg-linear-to-b xl:top-[13px] xl:left-3.5 xl:h-0.5 xl:w-[calc(100%+24px)] xl:origin-left xl:bg-linear-to-r',
                      step.rail,
                    )}
                  />
                </>
              )}
              <span
                aria-hidden="true"
                data-dot
                className="absolute -top-1.5 left-0.5 z-10 flex size-7 items-center justify-center rounded-full xl:relative xl:top-0 xl:left-0"
              >
                <span
                  className={cn(
                    'absolute inset-0 rounded-full opacity-20',
                    step.dot,
                  )}
                />
                <span
                  data-ping
                  className={cn(
                    'absolute inset-0 rounded-full opacity-0',
                    step.dot,
                  )}
                />
                <span
                  className={cn(
                    'relative size-3 rounded-full shadow-[0_0_0_3px_white,0_4px_10px_rgb(0_0_0/0.18)]',
                    step.dot,
                  )}
                />
              </span>
              <div data-body>
                <p
                  className={cn(
                    'text-[12px] leading-[15px] font-bold tracking-[1.6px] whitespace-pre uppercase xl:mt-6 xl:text-13 xl:leading-4 xl:tracking-[1.8px]',
                    step.ink,
                  )}
                >
                  {step.label}
                </p>
                <h3 className="mt-[7px] text-26 leading-[29px] font-bold tracking-[-0.6px] xl:mt-2.5 xl:text-28 xl:leading-[31px] xl:tracking-[-0.8px]">
                  {step.title}
                </h3>
                <p className="mt-2 text-15 leading-[23px] text-site-muted xl:mt-2.5 xl:text-16 xl:leading-6">
                  {step.text}
                </p>
                <div className="mt-6 xl:mt-7">{step.card}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Offline                                                                    */
/* -------------------------------------------------------------------------- */

function OfflineQueue({ copy }: { copy: LandingCopy['offline'] }) {
  const queue = [
    { ...copy.queue[0], tone: 'deep' },
    { ...copy.queue[1], tone: 'dark' },
    { ...copy.queue[2], tone: 'light' },
  ] as const;
  return (
    <div
      aria-hidden="true"
      data-queue
      className={cn(
        '-mt-4 hidden h-60 w-[500px] shrink-0 rounded-[22px] px-5 xl:block',
        WELL,
      )}
    >
      <p className="flex h-[52px] items-center gap-3 text-15 leading-[18px] font-semibold">
        <span data-plane className="inline-flex">
          <Plane size={16} className="fill-ios-orange-light" />
        </span>
        {copy.queueTitle}
      </p>
      <ul className="mt-3 flex flex-col gap-1">
        {queue.map((p, i) => (
          <li
            key={p.name}
            data-row
            className="relative flex h-[52px] gap-3.5 pt-1.5"
          >
            <ParcelThumb size={40} tone={p.tone} />
            <div className="flex-1 pt-px">
              <p className="text-15 leading-[18px] font-semibold">{p.name}</p>
              <p className="mt-[3px] text-13 leading-4 text-site-subtle">
                {p.meta}
              </p>
            </div>
            <span className="relative mt-[7px] h-[26px] w-[120px]">
              <span
                data-done
                className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-[13px] bg-ios-green/16 text-13 leading-4 font-semibold text-site-green-ink"
              >
                <Tick size={13} />
                {copy.chipSynced}
              </span>
              <span
                data-pend
                className="absolute inset-0 flex items-center justify-center rounded-[13px] bg-ios-orange-light/16 opacity-0 text-13 leading-4 font-semibold text-site-orange-ink"
              >
                {copy.pending}
              </span>
            </span>
            {i < queue.length - 1 && (
              <span className="absolute right-0 bottom-0 left-[54px] h-px bg-black/8" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function OfflineChips({ copy }: { copy: LandingCopy['offline'] }) {
  return (
    <div
      aria-hidden="true"
      data-chips
      className="mt-5 flex items-center gap-2 xl:hidden"
    >
      <span
        data-pending-chip
        className="flex h-10 w-[140px] items-center gap-2 rounded-[12px] bg-ios-orange-light/14 pl-3 text-14 leading-[17px] font-semibold text-site-orange-ink"
      >
        <span className="size-2.5 rounded-full bg-ios-orange-light" />
        {copy.chipPending}
      </span>
      <svg
        viewBox="0 0 14 10"
        width={14}
        height={10}
        className="overflow-visible fill-none stroke-faint"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path data-arrow d="M0,5L14,5M9,0L14,5L9,10" />
      </svg>
      <span
        data-synced
        className="flex h-10 w-[140px] items-center gap-2 rounded-[12px] bg-ios-green/14 pl-3 text-14 leading-[17px] font-semibold text-site-green-ink"
      >
        <Tick size={12} />
        {copy.chipSynced}
      </span>
    </div>
  );
}

export function Offline({ copy }: { copy: LandingCopy['offline'] }) {
  return (
    <section id="hors-ligne" className={cn(CONTAINER, 'mt-12 xl:mt-16')}>
      <div
        data-scene="offline"
        data-offline
        className={cn(
          'relative rounded-[24px] bg-white px-5 pt-[22px] pb-[22px] ring-1 ring-black/6 ring-inset xl:flex xl:h-80 xl:justify-between xl:rounded-[32px] xl:pt-14 xl:pr-10 xl:pl-14',
          RELIEF_BODY,
        )}
      >
        <span
          aria-hidden="true"
          data-flight
          className="pointer-events-none absolute inset-x-5 top-1 h-4 overflow-hidden xl:inset-x-10 xl:top-6 xl:h-5"
        >
          <span
            data-trail
            className="absolute top-1/2 left-0 h-px w-full origin-left bg-linear-to-r from-site-purple/0 to-site-purple/50 opacity-0"
          />
          <span data-flyer className="absolute top-0 left-0 opacity-0">
            <Plane size={16} className="rotate-90 fill-site-purple" />
          </span>
        </span>
        <div>
          <div className="flex gap-4 xl:flex-col xl:gap-0">
            <span className="flex size-11 shrink-0 items-start justify-center rounded-full bg-linear-to-b from-[#9a6df0] to-site-purple pt-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_8px_16px_-6px_rgba(120,70,220,0.55)] xl:size-[52px] xl:pt-[9px]">
              <Plane size={24} className="fill-white xl:hidden" />
              <Plane size={28} className="hidden fill-white xl:block" />
            </span>
            <div className="mt-1 xl:mt-[26px]">
              <p className="text-[12px] leading-[15px] font-bold tracking-[1.6px] text-site-purple-ink uppercase xl:text-13 xl:leading-4 xl:tracking-[1.8px]">
                {copy.eyebrow}
              </p>
              <h2
                data-split
                className="mt-[3px] text-18 leading-[22px] font-bold xl:mt-2.5 xl:text-[40px] xl:leading-[48px] xl:tracking-[-1.4px]"
              >
                {copy.title}
              </h2>
            </div>
          </div>
          <p
            data-split
            className="mt-5 text-15 leading-[23px] text-site-muted xl:mt-2 xl:max-w-[520px] xl:text-17 xl:leading-[26px]"
          >
            {copy.text}
          </p>
          <OfflineChips copy={copy} />
        </div>
        <OfflineQueue copy={copy} />
        <BorderBeam
          radius={24}
          from="#9a6df0"
          to="#ffb24a"
          duration={9}
          delay={4}
          span="w-[200%]"
        />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Install                                                                    */
/* -------------------------------------------------------------------------- */

const GESTURE_CARD =
  'flex h-[360px] w-[274px] shrink-0 snap-start flex-col items-center rounded-[26px] pt-6 ring-1 ring-black/8 ring-inset bg-linear-to-b from-white to-site-fill shadow-[inset_0_1px_0_rgb(255_255_255),0_2px_4px_rgb(29_29_31/0.05),0_18px_30px_-16px_rgb(29_29_31/0.25)]';

function GestureCard({
  index,
  title,
  scene,
  phone,
}: {
  index: number;
  title: string;
  scene: string;
  phone: ReactNode;
}) {
  return (
    <li
      data-card
      data-scene={scene}
      data-index={index - 1}
      className={GESTURE_CARD}
    >
      {phone}
      <p className="mt-[18px] flex w-full items-center gap-2.5 pl-[22px] text-16 leading-5 font-semibold">
        <span className="flex size-[26px] items-center justify-center rounded-full bg-site-ink text-13 leading-4 font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_3px_6px_rgba(20,24,40,0.3)]">
          {index}
        </span>
        {title}
      </p>
    </li>
  );
}

const SNAP_INSET = 20;

/** Where the gallery can rest: one stop per card, merged once the end is reached. */
function snapStops(gallery: HTMLElement) {
  const max = gallery.scrollWidth - gallery.clientWidth;
  const cards = [
    ...gallery.querySelectorAll<HTMLElement>(':scope > li'),
  ].filter((li) => li.offsetWidth > 0);
  const stops: number[] = [];
  for (const card of cards) {
    const left = Math.max(0, Math.min(max, card.offsetLeft - SNAP_INSET));
    if (!stops.some((stop) => Math.abs(stop - left) < 2)) stops.push(left);
  }
  return stops;
}

function useGallery() {
  const ref = useRef<HTMLOListElement>(null);
  const [stops, setStops] = useState<number[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const gallery = ref.current;
    if (!gallery) return;
    const update = () => {
      const next = snapStops(gallery);
      let best = 0;
      next.forEach((stop, i) => {
        if (
          Math.abs(stop - gallery.scrollLeft) <
          Math.abs((next[best] ?? 0) - gallery.scrollLeft)
        )
          best = i;
      });
      setStops(next);
      setActive(best);
    };
    update();
    gallery.addEventListener('scroll', update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(gallery);
    return () => {
      gallery.removeEventListener('scroll', update);
      resize.disconnect();
    };
  }, []);

  const goTo = (i: number) => {
    const left = stops[i];
    if (left === undefined) return;
    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    ref.current?.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' });
  };

  return { ref, stops: stops.length, active, goTo };
}

export function Install({
  copy,
  appName,
  url,
  host,
}: {
  copy: LandingCopy['install'];
  appName: string;
  url: string;
  host: string;
}) {
  const gallery = useGallery();
  const gestures = [
    { title: copy.gestures[0], scene: 'tap-share', phone: <SafariPhone /> },
    { title: copy.gestures[1], scene: 'tap-sheet', phone: <ShareSheetPhone /> },
    {
      title: copy.gestures[2],
      scene: 'home',
      phone: <HomeScreenPhone appName={appName} />,
    },
  ];
  return (
    <section id="installation" data-install className="relative mt-12 xl:mt-20">
      <Glow
        x={-120}
        y={-27}
        w={320}
        h={260}
        alpha={0.16}
        sigma={100}
        className="text-kraft xl:hidden"
      />
      <div className={CONTAINER}>
        <SectionHeading
          eyebrow={copy.eyebrow}
          title={copy.title}
          text={copy.text}
          titleClass="mt-[9px] text-34 leading-9 tracking-[-1px] xl:mt-3 xl:text-[52px] xl:leading-[55px] xl:tracking-[-2px]"
          textClass="mt-2.5 xl:mt-0"
        />
      </div>
      <div className="relative mx-auto mt-8 max-w-[480px] xl:mt-12 xl:max-w-none">
        <ol
          ref={gallery.ref}
          data-gallery
          className="flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pt-2 pb-8 [scrollbar-width:none] xl:mx-auto xl:max-w-[1240px] xl:justify-between xl:gap-0 xl:overflow-visible"
        >
          <li
            data-card
            className={cn(
              'relative hidden h-[360px] w-[274px] shrink-0 flex-col items-center rounded-[26px] bg-white pt-8 ring-1 ring-black/8 ring-inset xl:flex',
              RELIEF_BODY,
            )}
          >
            <AppQr value={url} size={200} radius={0} />
            <p className="mt-[30px] text-18 leading-[22px] font-bold">
              {copy.scanTitle}
            </p>
            <p className="mt-2 text-14 leading-[21px] text-site-muted">
              {copy.scanText}
            </p>
            <p className="mt-[5px] font-mono text-13 leading-4 font-semibold text-blue">
              {host}
            </p>
            <BorderBeam
              radius={26}
              duration={7}
              from="#ffb24a"
              to="#4f8cff"
              span="w-[260%]"
            />
          </li>
          {gestures.map((g, i) => (
            <GestureCard key={g.title} index={i + 1} {...g} />
          ))}
        </ol>
        {/* Tells the thumb the row scrolls: the next card fades out. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-0 h-full w-14 bg-linear-to-r from-white/0 to-white xl:hidden"
        />
      </div>
      {gallery.stops > 1 && (
        <div className="-mt-2 flex justify-center xl:hidden">
          {Array.from({ length: gallery.stops }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => gallery.goTo(i)}
              aria-label={`Position ${i + 1} sur ${gallery.stops}`}
              aria-current={i === gallery.active ? 'step' : undefined}
              className="flex h-6 items-center px-1"
            >
              <span
                className={cn(
                  'h-2 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none',
                  i === gallery.active
                    ? 'w-5 bg-site-ink'
                    : 'w-2 bg-site-fill-2',
                )}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Closing and footer                                                         */
/* -------------------------------------------------------------------------- */

export function Closing({
  copy,
  url,
}: {
  copy: LandingCopy['closing'];
  url: string;
}) {
  return (
    <section className={cn(CONTAINER, 'mt-9 xl:mt-24')}>
      <div data-closing-cta className="xl:hidden">
        <ShimmerLink
          href="#installation"
          className="flex h-14 w-full text-17 leading-[21px]"
        >
          {copy.install}
        </ShimmerLink>
      </div>
      <p className="mt-4 px-3 text-center text-13 leading-4 text-site-subtle xl:hidden">
        {copy.alreadyInstalled}
      </p>
      <div
        data-scene="closing"
        data-closing
        className={cn(
          'relative hidden h-[220px] overflow-hidden rounded-[32px] bg-linear-to-br from-site-fill via-site-kraft-wash via-60% to-site-kraft-wash-2 pt-[60px] pl-14 xl:block',
          RELIEF_BODY,
        )}
      >
        <DotPattern className="opacity-70" size={20} />
        <span
          aria-hidden="true"
          data-sheen
          className="absolute -top-10 -left-[300px] h-[320px] w-[200px] rotate-12 bg-linear-to-r from-white/0 via-white/60 to-white/0"
        />
        <h2
          data-split
          className="relative text-[40px] leading-[48px] font-bold tracking-[-1.4px]"
        >
          {copy.title}
        </h2>
        <p
          data-split
          className="relative mt-2 text-17 leading-[26px] text-site-muted"
        >
          {copy.text}
        </p>
        <div className="absolute top-10 right-9 flex gap-6">
          <p className="mt-[52px] text-right text-15 leading-[18px]">
            <span className="block font-semibold">{copy.scanTitle}</span>
            <span className="mt-1 block text-site-muted">{copy.scanText}</span>
          </p>
          <div
            data-closing-qr
            className="relative rounded-[18px] shadow-[0_18px_30px_-10px_rgb(0_0_0/0.3)]"
          >
            <AppQr value={url} size={140} radius={14} />
            <span
              aria-hidden="true"
              className="absolute inset-0 overflow-hidden rounded-[14px]"
            >
              <span
                data-laser
                className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-ios-green opacity-0 shadow-[0_0_10px_rgb(52_199_89/0.8)]"
              />
            </span>
          </div>
        </div>
        <BorderBeam radius={32} duration={10} delay={1} span="w-[130%]" />
      </div>
    </section>
  );
}

export function Footer({
  copy,
  appName,
  version,
}: {
  copy: LandingCopy['footer'];
  appName: string;
  version: string;
}) {
  return (
    <footer className={cn(CONTAINER, 'pb-10 xl:pb-[60px]')}>
      <div className="mt-[62px] h-px bg-black/10 xl:mt-20" />
      <div className="mt-[27px] grid xl:mt-[35px] xl:grid-cols-[1fr_auto] xl:items-center">
        <AppBrand size="footer" name={appName} />
        <p className="mt-5 text-13 leading-4 text-site-subtle xl:col-start-1 xl:mt-6 xl:text-14 xl:leading-[17px]">
          {copy.service}
        </p>
        <p className="mt-1 text-13 leading-4 text-muted-2 xl:col-start-2 xl:row-start-1 xl:mt-0 xl:text-14 xl:leading-[17px]">
          {copy.usage} {version}
        </p>
      </div>
    </footer>
  );
}
