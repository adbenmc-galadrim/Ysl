import { AppBrand } from '#components/app-mark';
import { Glow } from '#components/glow';
import { ParcelListPhone } from '#components/phone-mockup';
import { ScanScene } from '#components/scan-scene';
import type { LandingCopy } from '#components/landing-page';
import {
  BorderBeam,
  DotPattern,
  RELIEF,
  Rise,
  ShimmerLink,
  Spotlight,
  Tilt,
  useSpotlight,
} from '#components/landing-page/effects';
import { AppQr, CONTAINER, EYEBROW } from '#components/landing-page/shared';
import { cn } from '#lib/tv';

function Nav({
  copy,
  appName,
  signInHref,
}: {
  copy: LandingCopy['nav'];
  appName: string;
  signInHref: string;
}) {
  const links = [
    { href: '#parcours', label: copy.journey },
    { href: '#hors-ligne', label: copy.offline },
    { href: '#installation', label: copy.install },
  ];
  return (
    <div className="relative z-20 xl:bg-white/86">
      <nav
        className={cn(
          CONTAINER,
          'relative flex items-center justify-between pt-[17px] xl:h-[72px] xl:pt-0',
        )}
      >
        <a href="#top" aria-label={copy.home}>
          <AppBrand size="nav" name={appName} />
        </a>
        <ul className="absolute left-[460px] hidden gap-11 xl:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-15 leading-[18px] text-site-muted transition-colors hover:text-site-ink"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4 xl:gap-6">
          <a
            href={signInHref}
            className="text-14 leading-[17px] font-medium text-site-ink xl:text-15 xl:leading-[18px]"
          >
            {copy.signIn}
          </a>
          <a
            href="#installation"
            className="flex h-8 w-[88px] items-center justify-center rounded-full bg-black/8 text-14 leading-[17px] font-semibold text-site-ink xl:hidden"
          >
            {copy.cta}
          </a>
          <ShimmerLink
            href="#installation"
            className="hidden h-9 w-[100px] text-15 leading-[18px] xl:inline-flex"
          >
            {copy.cta}
          </ShimmerLink>
        </div>
      </nav>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 hidden h-px bg-black/8 xl:block"
      />
    </div>
  );
}

function Perks({ perks }: { perks: LandingCopy['hero']['perks'] }) {
  return (
    <ul
      className={cn(
        'mt-7 flex h-14 items-center rounded-[18px] xl:mt-10 xl:h-5 xl:rounded-none xl:bg-transparent xl:shadow-none xl:ring-0',
        'bg-white ring-1 ring-black/8 ring-inset',
        RELIEF,
      )}
    >
      {perks.map((perk, i) => (
        <li key={perk} className="contents">
          {i > 0 && (
            <span
              aria-hidden="true"
              className="h-6 w-px shrink-0 bg-black/10 xl:mx-6 xl:h-5"
            />
          )}
          <span className="flex-1 text-center text-13 leading-4 font-semibold xl:flex-none xl:text-16 xl:leading-5">
            {perk}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Hero({
  copy,
  appName,
  url,
  signInHref,
}: {
  copy: LandingCopy;
  appName: string;
  url: string;
  signInHref: string;
}) {
  const hero = copy.hero;
  const spot = useSpotlight();
  return (
    <header id="top" className="relative" onPointerMove={spot.onPointerMove}>
      <ScanScene
        size="phone"
        className="absolute inset-x-0 top-0 -z-10 xl:hidden"
      />
      <DotPattern className="-z-10 hidden h-[800px] xl:block" />
      <Spotlight x={spot.x} y={spot.y} />
      <Nav copy={copy.nav} appName={appName} signInHref={signInHref} />
      <div className={cn(CONTAINER, 'relative xl:h-[808px]')}>
        <Glow
          x={-160}
          y={88}
          w={420}
          h={300}
          alpha={0.06}
          sigma={120}
          className="hidden text-site-blue xl:block"
        />
        <Glow
          x={740}
          y={-32}
          w={520}
          h={360}
          alpha={0.22}
          sigma={120}
          className="hidden text-kraft-light xl:block"
        />
        <div className="mt-[567px] xl:mt-0 xl:pt-[104px]">
          <Rise y={14}>
            <p className={cn(EYEBROW, 'text-site-green-ink')}>{hero.eyebrow}</p>
          </Rise>
          <Rise y={26} delay={0.08}>
            <h1 className="mt-[9px] w-[350px] text-[44px] leading-[44px] font-bold tracking-[-1.4px] xl:mt-3.5 xl:w-[560px] xl:text-[76px] xl:leading-[74.5px] xl:tracking-[-3px]">
              {hero.titleLead}
              <br className="max-xl:hidden" /> {hero.titleTail}
            </h1>
          </Rise>
          <Rise y={18} delay={0.18}>
            <p className="mt-2.5 text-17 leading-[25px] text-site-muted xl:mt-[21px] xl:text-20 xl:leading-[30px]">
              {hero.lineOne}
              <br />
              {hero.lineTwo}
            </p>
          </Rise>
          <ShimmerLink
            href="#installation"
            className="mt-8 flex h-14 w-full text-17 leading-[21px] xl:hidden"
          >
            {hero.install}
          </ShimmerLink>
          <a
            href="#parcours"
            className="mt-4 block text-center text-15 leading-[18px] font-medium text-site-ink/70 xl:hidden"
          >
            {hero.howItWorks}
          </a>
          <Rise
            y={20}
            delay={0.28}
            className="relative mt-10 hidden h-40 w-[500px] xl:block"
          >
            <div
              className={cn(
                'relative flex h-40 w-[500px] gap-6 rounded-[24px] bg-white p-5 ring-1 ring-black/6 ring-inset',
                RELIEF,
              )}
            >
              <AppQr value={url} size={120} radius={14} />
              <div className="pt-3">
                <p className="text-[19px] leading-[23px] font-semibold">
                  {hero.scanTitle}
                </p>
                <p className="mt-[7px] text-15 leading-[22px] text-site-muted">
                  {hero.scanText}
                </p>
                <a
                  href="#installation"
                  className="mt-8 block text-15 leading-[18px] font-medium text-site-blue-ink"
                  aria-label={hero.scanLinkLabel}
                >
                  {hero.scanLink}
                </a>
              </div>
              <BorderBeam radius={24} duration={8} />
            </div>
          </Rise>
          <Perks perks={hero.perks} />
        </div>
        <Tilt className="absolute top-12 left-[640px] hidden xl:block" max={3}>
          <div
            className={cn(
              'relative overflow-hidden rounded-[32px] shadow-[0_2px_4px_rgba(20,24,40,0.06),0_18px_32px_-18px_rgba(20,24,40,0.28)]',
            )}
          >
            <ScanScene size="desk" />
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-[32px] ring-1 ring-black/10 ring-inset"
            />
          </div>
        </Tilt>
        {/* Clipped where the next section starts, so the phone's shadow does
            not spill under the heading below the fade. */}
        <div className="absolute top-[268px] left-[500px] hidden h-[540px] w-[350px] overflow-hidden xl:block">
          <ParcelListPhone className="absolute top-[60px] left-[60px]" />
        </div>
        <span
          aria-hidden="true"
          className="absolute top-[648px] left-[500px] hidden h-40 w-[350px] bg-linear-to-b from-site-wash-3/0 via-site-wash-3 via-45% to-site-wash-3 xl:block"
        />
      </div>
    </header>
  );
}
