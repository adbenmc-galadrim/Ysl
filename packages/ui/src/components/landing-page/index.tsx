import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useRef, type RefObject } from 'react';

import { Hero } from '#components/landing-page/header';
import { playScenes } from '#components/landing-page/scenes';
import {
  Closing,
  Footer,
  Install,
  Journey,
  Offline,
} from '#components/landing-page/sections';

/*
 * The landing page: what someone sees in a browser tab before installing the
 * app. One component for both layouts — the phone is the base, the desktop
 * page takes over from `xl` — so the copy exists once. Every card plays the
 * scene it describes, once, when it comes into view. Nothing is pinned and
 * nothing hijacks the scroll: the page scrolls natively, ScrollTrigger only
 * reads it.
 *
 * Three tiers through gsap.matchMedia(): desktop, phone, and reduced motion,
 * where nothing is set up at all and the page is its finished picture.
 */

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

const MEDIA = {
  phone: '(max-width: 1279px) and (prefers-reduced-motion: no-preference)',
  desk: '(min-width: 1280px) and (prefers-reduced-motion: no-preference)',
};

const qa = (root: HTMLElement, selector: string) =>
  gsap.utils.toArray<HTMLElement>(selector, root);

/** Headings and lead paragraphs rise line by line out of a mask. */
function splitReveals(root: HTMLElement) {
  qa(root, '[data-split]').forEach((el) => {
    if (el.offsetParent === null) return;
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises -- SplitText wants the tween back to re-run it on resplit
      onSplit: (self) => {
        // A mask as tall as the line-height clips descenders (g, p) and accents.
        gsap.set(self.masks, {
          paddingTop: '0.12em',
          marginTop: '-0.12em',
          paddingBottom: '0.22em',
          marginBottom: '-0.22em',
        });
        return gsap.from(self.lines, {
          yPercent: 115,
          duration: 0.9,
          stagger: 0.09,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 92%',
            toggleActions: 'play none none none',
          },
        });
      },
    });
  });
}

/**
 * The journey: a rail is drawn by the scroll and each step lights as the rail
 * reaches it. On desktop the three columns share one scrubbed timeline; on a
 * phone each step lights (and un-lights, going back up) on its own and its
 * stretch of rail is drawn while it crosses the screen.
 */
function journey(root: HTMLElement, desk: boolean) {
  const steps = qa(root, '[data-step]');
  const part = (li: HTMLElement, s: string) => li.querySelector<HTMLElement>(s);

  if (desk) {
    steps.forEach((li) => {
      gsap.set(part(li, '[data-dot]'), { scale: 0.6, opacity: 0.35 });
      gsap.set(part(li, '[data-body]'), { opacity: 0.3, y: 34 });
      gsap.set(part(li, '[data-rail]'), { scaleX: 0 });
    });
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '[data-steps]',
        start: 'top 74%',
        end: 'top 22%',
        scrub: 0.6,
      },
    });
    steps.forEach((li, i) => {
      const at = i * 1.1;
      tl.to(
        part(li, '[data-dot]'),
        { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2.4)' },
        at,
      )
        .to(
          part(li, '[data-body]'),
          { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' },
          at,
        )
        .set(part(li, '[data-ping]'), { opacity: 0.5, scale: 0.7 }, at + 0.1)
        .to(
          part(li, '[data-ping]'),
          { opacity: 0, scale: 2, duration: 0.7, ease: 'power1.out' },
          at + 0.1,
        )
        .to(
          part(li, '[data-rail]'),
          { scaleX: 1, duration: 0.9, ease: 'none' },
          at + 0.2,
        );
    });
    return;
  }

  steps.forEach((li) => {
    const dot = part(li, '[data-dot]');
    const body = part(li, '[data-body]');
    const ping = part(li, '[data-ping]');
    const rail = part(li, '[data-rail]');
    gsap.set(dot, { scale: 0.5, opacity: 0.35 });
    gsap.set(body, { opacity: 0.3, y: 26 });
    gsap
      .timeline({
        scrollTrigger: {
          trigger: li,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      })
      .to(
        dot,
        { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2.4)' },
        0,
      )
      .to(body, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.05)
      .set(ping, { opacity: 0.5, scale: 0.7 }, 0.1)
      .to(
        ping,
        { opacity: 0, scale: 2, duration: 0.7, ease: 'power1.out' },
        0.1,
      );
    if (rail) {
      gsap.fromTo(
        rail,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: li,
            start: 'top 76%',
            end: 'bottom+=58 66%',
            scrub: 0.3,
          },
        },
      );
    }
  });
}

/** Sections that come in once: the offline card, the install cards, the closing button. */
function reveals(root: HTMLElement, desk: boolean) {
  const once = (trigger: string, start: string) => ({
    trigger,
    start,
    toggleActions: 'play none none none',
  });
  gsap.from('[data-offline]', {
    y: 40,
    opacity: 0,
    duration: 0.9,
    ease: 'power3.out',
    scrollTrigger: once('[data-offline]', 'top 90%'),
  });
  gsap.from(qa(root, '[data-gallery] > [data-card]'), {
    opacity: 0,
    x: desk ? 60 : 36,
    duration: 0.8,
    stagger: 0.12,
    ease: 'power3.out',
    scrollTrigger: once('[data-gallery]', 'top 86%'),
  });
  if (desk) {
    gsap.to('[data-sheen]', {
      x: 1600,
      ease: 'none',
      scrollTrigger: {
        trigger: '[data-closing]',
        start: 'top 90%',
        end: 'bottom 30%',
        scrub: 0.5,
      },
    });
  } else {
    gsap.from('[data-closing-cta]', {
      opacity: 0,
      y: 24,
      duration: 0.7,
      ease: 'power3.out',
      scrollTrigger: once('[data-closing-cta]', 'top 94%'),
    });
  }
}

const SCROLL_KEY = 'landing-page-scroll';

/**
 * ScrollTrigger measures the page by jumping to the top and back, which the
 * site's `scroll-behavior: smooth` turns into a slide that cancels the
 * router's own scroll restoration. So while this page lives scrolling is
 * instant (anchor links keep their glide, asked for explicitly) and the
 * position is restored here, from where the page was left.
 */
function useStableScroll(root: RefObject<HTMLDivElement | null>) {
  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const html = document.documentElement;
      const previous = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';

      const save = () =>
        sessionStorage.setItem(SCROLL_KEY, String(Math.round(window.scrollY)));
      const onClick = (e: MouseEvent) => {
        const link = (e.target as Element | null)?.closest<HTMLAnchorElement>(
          'a[href^="#"]',
        );
        if (!link) return;
        if (!link.hash) return;
        const target =
          link.hash === '#top'
            ? document.body
            : document.querySelector(link.hash);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(history.state, '', link.hash);
      };
      window.addEventListener('pagehide', save);
      el.addEventListener('click', onClick);

      const saved = Number(sessionStorage.getItem(SCROLL_KEY) ?? 0);
      if (saved > 0) window.scrollTo({ top: saved, behavior: 'instant' });

      return () => {
        window.removeEventListener('pagehide', save);
        el.removeEventListener('click', onClick);
        sessionStorage.removeItem(SCROLL_KEY);
        html.style.scrollBehavior = previous;
      };
    },
    { scope: root },
  );
}

function useNarrative(root: RefObject<HTMLDivElement | null>) {
  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      ScrollTrigger.config({ ignoreMobileResize: true });
      const mm = gsap.matchMedia(el);

      mm.add(MEDIA, (ctx) => {
        const { phone, desk } = ctx.conditions as Record<
          string,
          boolean | undefined
        >;
        if (!phone && !desk) return; // reduced motion: the page stays as drawn
        const wide = Boolean(desk);
        splitReveals(el);
        journey(el, wide);
        reveals(el, wide);
        return playScenes(el, wide);
      });

      const refresh = () => ScrollTrigger.refresh();
      void document.fonts?.ready.then(refresh);
      window.addEventListener('load', refresh);
      return () => {
        window.removeEventListener('load', refresh);
        mm.revert();
      };
    },
    { scope: root },
  );
}

type JourneyStepCopy = { label: string; title: string; text: string };

/** Every visible word of the landing page, and the labels read aloud. */
export type LandingCopy = {
  nav: {
    home: string;
    journey: string;
    offline: string;
    install: string;
    cta: string;
    signIn: string;
  };
  hero: {
    eyebrow: string;
    titleLead: string;
    titleTail: string;
    lineOne: string;
    lineTwo: string;
    install: string;
    howItWorks: string;
    scanTitle: string;
    scanText: string;
    scanLink: string;
    scanLinkLabel: string;
    perks: [string, string, string];
  };
  journey: {
    eyebrow: string;
    title: string;
    text: string;
    received: JourneyStepCopy;
    notified: JourneyStepCopy;
    handedOver: JourneyStepCopy;
    batch: { title: string; progress: string; names: string };
    notification: {
      device: string;
      sender: string;
      time: string;
      title: string;
      body: string;
      footnote: string;
    };
    handover: { codeLabel: string; handedAt: string; signature: string };
  };
  offline: {
    eyebrow: string;
    title: string;
    text: string;
    chipPending: string;
    chipSynced: string;
    queueTitle: string;
    pending: string;
    queue: [QueuedParcel, QueuedParcel, QueuedParcel];
  };
  install: {
    eyebrow: string;
    title: string;
    text: string;
    scanTitle: string;
    scanText: string;
    gestures: [string, string, string];
  };
  closing: {
    install: string;
    alreadyInstalled: string;
    title: string;
    text: string;
    scanTitle: string;
    scanText: string;
  };
  footer: { service: string; usage: string };
};

type QueuedParcel = { name: string; meta: string };

export type LandingPageProps = {
  copy: LandingCopy;
  appName: string;
  /** What the install QR codes open. */
  url: string;
  /** Where the app lives, printed under the QR code. */
  host: string;
  /** Printed in the footer, after the usage line. */
  version: string;
  /** Where the « Se connecter » link of the nav leads. */
  signInHref: string;
};

export function LandingPage({
  copy,
  appName,
  url,
  host,
  version,
  signInHref,
}: LandingPageProps) {
  const root = useRef<HTMLDivElement>(null);
  useStableScroll(root);
  useNarrative(root);
  return (
    <div
      ref={root}
      className="relative isolate min-h-dvh overflow-x-clip bg-white text-site-ink"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 hidden h-[900px] bg-linear-to-b from-site-wash via-site-wash-2 via-55% to-white xl:block"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-[353px] bg-linear-to-b from-white via-site-fill via-55% to-site-fill xl:h-[521px] xl:via-70%"
      />
      <Hero copy={copy} appName={appName} url={url} signInHref={signInHref} />
      <main>
        <Journey copy={copy.journey} />
        <Offline copy={copy.offline} />
        <Install copy={copy.install} appName={appName} url={url} host={host} />
        <Closing copy={copy.closing} url={url} />
      </main>
      <Footer copy={copy.footer} appName={appName} version={version} />
    </div>
  );
}
