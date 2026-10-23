import type { ReactNode } from 'react';

import { AppBrand, AppMark } from '#components/app-mark';
import { BrandedQr } from '#components/branded-qr';
import { CheckDisc } from '#components/check-disc';
import { Glow } from '#components/glow';
import { MailIcon } from '#components/mail-icon';
import { ParcelThumb, type KraftTone } from '#components/parcel-thumb';
import {
  HomeScreenPhone,
  ParcelListPhone,
  SafariPhone,
  ShareSheetPhone,
} from '#components/phone-mockup';
import { Plane } from '#components/plane';
import { ScanScene } from '#components/scan-scene';
import { QR_LOGO } from '#lib/qr';
import { cn } from '#lib/tv';

/*
 * The landing page: what someone sees on courrier.ysl.fr before installing
 * the app. One component for both layouts — the phone is the base, the
 * desktop page takes over from `xl` — so the copy exists once.
 *
 * Measures come from Penpot page 10, boards « I · Blanc fondu » (390 px)
 * and « I · Blanc fondu — ordinateur » (1440 px).
 */

/**
 * Centres the content: 20 px gutters on the phone, 1200 px on desktop. In
 * between (tablets, small laptops) the phone layout stays a column: the
 * desktop grid needs its 1200 px.
 */
const CONTAINER = 'mx-auto w-full max-w-[480px] px-5 xl:max-w-[1240px]';

const EYEBROW =
  'text-[12px] leading-[15px] font-semibold tracking-[1.6px] uppercase xl:text-13 xl:leading-4 xl:tracking-[2px]';

/** A QR code with the app mark in its centre. */
function AppQr({
  value,
  size,
  radius,
  className,
}: {
  value: string;
  size: number;
  radius: number;
  className?: string;
}) {
  return (
    <BrandedQr
      value={value}
      size={size}
      radius={radius}
      logo={<AppMark size={size * QR_LOGO} edge="halo" />}
      className={className}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

const NAV_LINKS = [
  { href: '#parcours', label: 'Le parcours' },
  { href: '#hors-ligne', label: 'Hors ligne' },
  { href: '#installation', label: 'Installation' },
];

function Nav() {
  return (
    <div className="relative z-20 xl:bg-white/86">
      <nav
        className={cn(
          CONTAINER,
          'relative flex items-center justify-between pt-[17px] xl:h-[72px] xl:pt-0',
        )}
      >
        <a href="#top" aria-label="Courrier, accueil">
          <AppBrand size="nav" />
        </a>
        <ul className="absolute left-[460px] hidden gap-11 xl:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="text-15 leading-[18px] text-site-muted">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <a
          href="#installation"
          className="flex h-8 w-[88px] items-center justify-center rounded-full bg-black/8 text-14 leading-[17px] font-semibold text-site-ink xl:h-9 xl:w-[100px] xl:bg-site-ink xl:text-15 xl:leading-[18px] xl:text-white"
        >
          Installer
        </a>
      </nav>
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 hidden h-px bg-black/8 xl:block" />
    </div>
  );
}

const PERKS = ['Sans App Store', 'Même hors ligne', 'Un geste par colis'];

function Perks() {
  return (
    <ul className="mt-7 flex h-14 items-center rounded-[18px] bg-site-fill ring-1 ring-black/10 ring-inset xl:mt-10 xl:h-5 xl:rounded-none xl:bg-transparent xl:ring-0">
      {PERKS.map((perk, i) => (
        <li key={perk} className="contents">
          {i > 0 && (
            <span aria-hidden="true" className="h-6 w-px shrink-0 bg-black/10 xl:mx-6 xl:h-5" />
          )}
          <span className="flex-1 text-center text-13 leading-4 font-semibold xl:flex-none xl:text-16 xl:leading-5">
            {perk}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Hero({ host }: { host: string }) {
  return (
    <header id="top" className="relative">
      <ScanScene size="phone" className="absolute inset-x-0 top-0 -z-10 xl:hidden" />
      <Nav />
      <div className={cn(CONTAINER, 'relative xl:h-[808px]')}>
        <Glow x={-160} y={88} w={420} h={300} alpha={0.06} sigma={120} className="hidden text-site-blue xl:block" />
        <Glow x={740} y={-32} w={520} h={360} alpha={0.22} sigma={120} className="hidden text-kraft-light xl:block" />
        <div className="mt-[567px] xl:mt-0 xl:pt-[104px]">
          <p className={cn(EYEBROW, 'text-site-green-ink')}>Service courrier</p>
          <h1 className="mt-[9px] w-[350px] text-[44px] leading-[44px] font-bold tracking-[-1.4px] xl:mt-3.5 xl:w-[560px] xl:text-[76px] xl:leading-[74.5px] xl:tracking-[-3px]">
            Visez.<br className="max-xl:hidden" /> C’est enregistré.
          </h1>
          <p className="mt-2.5 text-17 leading-[25px] text-site-muted xl:mt-[21px] xl:text-20 xl:leading-[30px]">
            Réception, notification, remise.
            <br />
            Tout tient dans l’iPhone.
          </p>
          <a
            href="#installation"
            className="mt-8 flex h-14 items-center justify-center rounded-full bg-site-ink text-17 leading-[21px] font-semibold text-white xl:hidden"
          >
            Installer l’app
          </a>
          <a
            href="#parcours"
            className="mt-4 block text-center text-15 leading-[18px] font-medium text-site-ink/70 xl:hidden"
          >
            Comment ça marche
          </a>
          <div className="mt-10 hidden h-40 w-[500px] gap-6 rounded-[24px] bg-white/80 p-5 ring-1 ring-black/6 ring-inset xl:flex">
            <AppQr value={`https://${host}`} size={120} radius={14} />
            <div className="pt-3">
              <p className="text-[19px] leading-[23px] font-semibold">
                Scannez. Installez. C’est parti.
              </p>
              <p className="mt-[7px] text-15 leading-[22px] text-site-muted">
                Avec l’appareil photo de l’iPhone.
              </p>
              <a
                href="#installation"
                className="mt-8 block text-15 leading-[18px] font-medium text-site-blue-ink"
                aria-label={`Comment ça marche : installer depuis ${host}`}
              >
                Comment ça marche ↓
              </a>
            </div>
          </div>
          <Perks />
        </div>
        <div className="absolute top-12 left-[640px] hidden overflow-hidden rounded-[32px] xl:block">
          <ScanScene size="desk" />
          <span aria-hidden="true" className="absolute inset-0 rounded-[32px] ring-1 ring-black/10 ring-inset" />
        </div>
        {/* Clipped where the next section starts, so the phone's shadow does
            not spill under the heading below the fade. */}
        <div className="absolute top-[268px] left-[500px] hidden h-[540px] w-[350px] overflow-hidden xl:block">
          <ParcelListPhone className="absolute top-[60px] left-[60px]" />
        </div>
        <span
          aria-hidden="true"
          className="absolute top-[648px] left-[470px] hidden h-40 w-[420px] bg-linear-to-b from-site-wash-3/0 via-site-wash-3 via-45% to-site-wash-3 xl:block"
        />
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* The journey: received, notified, handed over                               */
/* -------------------------------------------------------------------------- */

const CARD =
  'rounded-[22px] bg-white shadow-site-card ring-1 ring-black/6 ring-inset xl:rounded-[24px]';

const PHOTO_CHECK = 'M3.5,7L6,9.5L10.5,4.5';

function BatchPhoto({ tone, read }: { tone: KraftTone; read: boolean }) {
  return (
    <span
      className={cn(
        'relative size-[60px] shrink-0 rounded-[12px] xl:size-[76px] xl:rounded-[14px]',
        tone === 'kraft' && 'bg-kraft',
        tone === 'mid' && 'bg-kraft-mid',
        tone === 'light' && 'bg-kraft-light',
      )}
    >
      <span className="absolute top-4 left-3.5 h-6 w-8 rounded-[2px] bg-paper xl:top-5 xl:left-[18px] xl:h-[30px] xl:w-10" />
      <span
        className={cn(
          'absolute top-7 left-[18px] h-2 w-6 xl:top-[35px] xl:left-[23px] xl:h-2.5 xl:w-[30px]',
          read ? 'bg-label-ink-2' : 'bg-site-fill-3',
        )}
      />
      <CheckDisc
        size={14}
        d={PHOTO_CHECK}
        stroke={1.6}
        className="absolute top-[42px] left-[42px] xl:top-[54px] xl:left-[54px] xl:size-4"
      />
    </span>
  );
}

function BatchCard() {
  return (
    <div className={cn(CARD, 'px-[18px] pt-[18px] pb-[15px] xl:px-6 xl:pt-6 xl:pb-[25px]')}>
      <div className="flex justify-between text-13 leading-4 xl:text-15 xl:leading-[18px]">
        <span className="font-semibold">Rafale en cours</span>
        <span className="text-site-subtle">3 sur 12</span>
      </div>
      <div className="mt-2.5 h-1 rounded-[2px] bg-site-fill-2 xl:mt-3">
        <div className="h-full w-1/4 rounded-[2px] bg-site-blue" />
      </div>
      <div aria-hidden="true" className="mt-4 flex gap-2.5 xl:mt-5">
        <BatchPhoto tone="kraft" read />
        <BatchPhoto tone="mid" read={false} />
        <BatchPhoto tone="light" read />
        <span className="flex size-[60px] shrink-0 items-center justify-center rounded-[12px] bg-site-fill xl:size-[76px] xl:rounded-[14px]">
          <span className="size-4 rounded-full ring-2 ring-faint ring-inset xl:size-5" />
        </span>
      </div>
      <p className="mt-3.5 text-[12px] leading-[15px] text-site-subtle xl:mt-6 xl:text-14 xl:leading-[17px]">
        Camille Roux, Hugo Bernard, Léa Martin…
      </p>
    </div>
  );
}

function NotificationCard() {
  return (
    <div className="xl:rounded-[24px] xl:bg-white xl:px-6 xl:pt-6 xl:pb-[25px] xl:shadow-site-card xl:ring-1 xl:ring-black/6 xl:ring-inset">
      <p className="hidden text-13 leading-4 text-site-subtle xl:block">iPhone de Camille</p>
      <div className="flex h-[92px] gap-3 rounded-[22px] bg-white pt-[15px] pr-3.5 pl-3.5 shadow-site-card ring-1 ring-black/6 ring-inset xl:-mx-1 xl:mt-4 xl:h-[100px] xl:gap-3.5 xl:bg-site-fill-2/80 xl:pt-4 xl:shadow-none xl:ring-0">
        <span className="mt-px xl:mt-0.5">
          <MailIcon size={38} className="xl:hidden" />
          <MailIcon size={40} className="hidden xl:flex" />
        </span>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <span className="text-14 leading-[17px] font-semibold xl:text-15 xl:leading-[18px]">
              Service courrier
            </span>
            <span className="mt-px text-[12px] leading-[15px] text-site-muted">maintenant</span>
          </div>
          <p className="mt-[3px] text-14 leading-[17px] font-medium xl:mt-1">
            Un colis vous attend à l’accueil
          </p>
          <p className="mt-[3px] text-13 leading-4 text-site-ink-2 xl:mt-[5px]">
            Présentez ce code au retrait : 4821.
          </p>
        </div>
      </div>
      <p className="mt-[22px] hidden text-14 leading-[17px] text-site-subtle xl:block">
        Envoyé depuis votre messagerie
      </p>
    </div>
  );
}

const PICKUP_CODE = '4821';

function HandoverCard() {
  return (
    <div className={cn(CARD, 'flex gap-4 p-4 xl:flex-wrap xl:gap-6 xl:p-6 xl:pb-[25px]')}>
      <BrandedQr value={PICKUP_CODE} size={118} radius={14} className="xl:hidden" />
      <AppQr value={PICKUP_CODE} size={130} radius={16} className="hidden xl:block" />
      <div>
        <p className="mt-1.5 text-[11px] leading-[14px] font-semibold tracking-[1.2px] text-site-subtle xl:mt-2 xl:tracking-[1.4px]">
          CODE DE RETRAIT
        </p>
        <p className="mt-1 font-mono text-34 leading-[41px] font-semibold tracking-[3px] xl:mt-1.5 xl:text-[40px] xl:leading-[48px] xl:tracking-[4px]">
          {PICKUP_CODE}
        </p>
        <p className="mt-[17px] flex h-[30px] w-[140px] items-center gap-1.5 rounded-[15px] bg-ios-green/16 pl-3 text-13 leading-4 font-semibold text-site-green-ink xl:mt-[18px] xl:h-8 xl:w-[150px] xl:gap-2 xl:rounded-[16px] xl:text-14 xl:leading-[17px]">
          <span className="size-2.5 rounded-full bg-ios-green" />
          Remis à 10 h 42
        </p>
      </div>
      <p className="hidden w-full text-14 leading-[17px] text-site-subtle xl:block">
        Signature : Camille Roux
      </p>
    </div>
  );
}

type Step = {
  label: string;
  title: string;
  text: string;
  dot: string;
  ink: string;
  rail?: string;
  card: ReactNode;
};

const STEPS: Step[] = [
  {
    label: '01  Reçu',
    title: 'Visez. Suivant.',
    text: 'Tout un lot, en une rafale.',
    dot: 'bg-site-blue',
    ink: 'text-site-blue-ink',
    rail: 'from-ios-blue to-ios-orange',
    card: <BatchCard />,
  },
  {
    label: '02  Notifié',
    title: 'Prévenu dans la seconde.',
    text: 'Son code de retrait avec.',
    dot: 'bg-ios-orange-light',
    ink: 'text-site-orange-ink',
    rail: 'from-ios-orange to-ios-green-dark',
    card: <NotificationCard />,
  },
  {
    label: '03  Remis',
    title: 'Remis en main propre.',
    text: 'Un code, une signature. C’est tracé.',
    dot: 'bg-ios-green',
    ink: 'text-site-green-ink',
    card: <HandoverCard />,
  },
];

function SectionHeading({
  eyebrow,
  title,
  text,
  titleClass,
  textClass,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  titleClass: string;
  textClass?: string;
}) {
  return (
    <div className="xl:flex xl:items-end xl:justify-between">
      <div>
        <p className={cn(EYEBROW, 'text-site-subtle')}>{eyebrow}</p>
        <h2 className={cn('font-bold', titleClass)}>{title}</h2>
      </div>
      {text && (
        <p className={cn('text-15 leading-[23px] text-site-muted xl:mb-1.5 xl:w-[480px] xl:text-18 xl:leading-[27px]', textClass)}>
          {text}
        </p>
      )}
    </div>
  );
}

function Journey() {
  return (
    <section id="parcours" className="relative mt-12 xl:mt-0">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -top-[46px] -z-10 h-[1346px] bg-[linear-gradient(to_bottom,var(--color-white),var(--color-site-fill)_14%,var(--color-site-fill)_86%,var(--color-white))] xl:top-0 xl:h-[1024px]"
      />
      <Glow x={230} y={44} w={260} h={220} alpha={0.1} sigma={90} className="text-site-blue xl:hidden" />
      <div className={cn(CONTAINER, 'relative')}>
        <Glow x={-20} y={220} w={380} h={260} alpha={0.08} sigma={110} className="hidden text-site-blue xl:block" />
        <Glow x={430} y={220} w={380} h={260} alpha={0.07} sigma={110} className="hidden text-ios-orange-light xl:block" />
        <Glow x={860} y={220} w={380} h={260} alpha={0.07} sigma={110} className="hidden text-ios-green xl:block" />
        <SectionHeading
          eyebrow="Le parcours"
          title="Un colis, trois moments."
          text="De l’accueil au destinataire. Sans un papier."
          titleClass="mt-[9px] w-[350px] text-34 leading-9 tracking-[-1px] xl:mt-3 xl:w-auto xl:text-[52px] xl:leading-[63px] xl:tracking-[-2px]"
          textClass="hidden xl:block"
        />
        <ol className="mt-[42px] flex flex-col gap-[58px] xl:mt-[59px] xl:grid xl:grid-cols-3 xl:gap-6">
          {STEPS.map((step) => (
            <li key={step.label} className="relative pl-11 xl:pl-0">
              {step.rail && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-2 left-[15px] h-[calc(100%+58px)] w-0.5 bg-linear-to-b xl:top-[13px] xl:left-3.5 xl:h-0.5 xl:w-[calc(100%+24px)] xl:bg-linear-to-r',
                    step.rail,
                  )}
                />
              )}
              <span
                aria-hidden="true"
                className="absolute -top-1.5 left-0.5 z-10 flex size-7 items-center justify-center rounded-full xl:relative xl:top-0 xl:left-0"
              >
                <span className={cn('absolute inset-0 rounded-full opacity-20', step.dot)} />
                <span className={cn('relative size-3 rounded-full', step.dot)} />
              </span>
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

const QUEUE = [
  { name: 'Nora Petit', meta: 'Studio · 8 h 55', tone: 'deep' },
  { name: 'Inès Garnier', meta: 'RH · 9 h 10', tone: 'dark' },
  { name: 'Paul Lefèvre', meta: 'Accessoires · 9 h 12', tone: 'light' },
] as const;

function OfflineQueue() {
  return (
    <div
      aria-hidden="true"
      className="-mt-4 hidden h-60 w-[500px] shrink-0 rounded-[22px] bg-site-fill px-5 xl:block"
    >
      <p className="flex h-[52px] items-center gap-3 text-15 leading-[18px] font-semibold">
        <Plane size={16} className="fill-ios-orange-light" />
        Mode avion · 3 colis en attente
      </p>
      <ul className="mt-3 flex flex-col gap-1">
        {QUEUE.map((p, i) => (
          <li key={p.name} className="relative flex h-[52px] gap-3.5 pt-1.5">
            <ParcelThumb size={40} tone={p.tone} />
            <div className="flex-1 pt-px">
              <p className="text-15 leading-[18px] font-semibold">{p.name}</p>
              <p className="mt-[3px] text-13 leading-4 text-site-subtle">{p.meta}</p>
            </div>
            <span className="mt-[7px] flex h-[26px] w-[108px] items-center justify-center rounded-[13px] bg-ios-orange-light/16 text-13 leading-4 font-semibold text-site-orange-ink">
              En attente
            </span>
            {i < QUEUE.length - 1 && (
              <span className="absolute right-0 bottom-0 left-[54px] h-px bg-black/8" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function OfflineChips() {
  return (
    <div aria-hidden="true" className="mt-5 flex items-center gap-2 xl:hidden">
      <span className="flex h-10 w-[140px] items-center gap-2 rounded-[12px] bg-ios-orange-light/14 pl-3 text-14 leading-[17px] font-semibold text-site-orange-ink">
        <span className="size-2.5 rounded-full bg-ios-orange-light" />3 en attente
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
        <path d="M0,5L14,5M9,0L14,5L9,10" />
      </svg>
      <span className="flex h-10 w-[140px] items-center gap-2 rounded-[12px] bg-ios-green/14 pl-3 text-14 leading-[17px] font-semibold text-site-green-ink">
        <span className="size-2.5 rounded-full bg-ios-green" />
        Synchronisé
      </span>
    </div>
  );
}

function Offline() {
  return (
    <section id="hors-ligne" className={cn(CONTAINER, 'mt-12 xl:mt-16')}>
      <div className="rounded-[24px] bg-white px-5 pt-[22px] pb-[22px] shadow-site-card ring-1 ring-black/6 ring-inset xl:flex xl:h-80 xl:justify-between xl:rounded-[32px] xl:pt-14 xl:pr-10 xl:pl-14">
        <div>
          <div className="flex gap-4 xl:flex-col xl:gap-0">
            <span className="flex size-11 shrink-0 items-start justify-center rounded-full bg-site-purple pt-2 xl:size-[52px] xl:pt-[9px]">
              <Plane size={24} className="fill-white xl:hidden" />
              <Plane size={28} className="hidden fill-white xl:block" />
            </span>
            <div className="mt-1 xl:mt-[26px]">
              <p className="text-[12px] leading-[15px] font-bold tracking-[1.6px] text-site-purple-ink uppercase xl:text-13 xl:leading-4 xl:tracking-[1.8px]">
                Hors ligne
              </p>
              <h2 className="mt-[3px] text-18 leading-[22px] font-bold xl:mt-2.5 xl:text-[40px] xl:leading-[48px] xl:tracking-[-1.4px]">
                Même au sous-sol.
              </h2>
            </div>
          </div>
          <p className="mt-5 text-15 leading-[23px] text-site-muted xl:mt-2 xl:text-17 xl:leading-[26px]">
            Pas de réseau ? Rien ne se perd.
          </p>
          <OfflineChips />
        </div>
        <OfflineQueue />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Install                                                                    */
/* -------------------------------------------------------------------------- */

const GESTURES = [
  { title: 'Partagez', phone: <SafariPhone /> },
  { title: 'Sur l’écran d’accueil', phone: <ShareSheetPhone /> },
  { title: 'C’est prêt.', phone: <HomeScreenPhone /> },
];

function GestureCard({ index, title, phone }: { index: number; title: string; phone: ReactNode }) {
  return (
    <li className="flex h-[360px] w-[274px] shrink-0 snap-start flex-col items-center rounded-[26px] bg-site-fill pt-6 ring-1 ring-black/8 ring-inset">
      {phone}
      <p className="mt-[18px] flex w-full items-center gap-2.5 pl-[22px] text-16 leading-5 font-semibold">
        <span className="flex size-[26px] items-center justify-center rounded-full bg-site-ink text-13 leading-4 font-bold text-white">
          {index}
        </span>
        {title}
      </p>
    </li>
  );
}

function Install({ host }: { host: string }) {
  return (
    <section id="installation" className="relative mt-12 xl:mt-20">
      <Glow x={-120} y={-27} w={320} h={260} alpha={0.16} sigma={100} className="text-kraft xl:hidden" />
      <div className={CONTAINER}>
        <SectionHeading
          eyebrow="Installation"
          title="Prête en trois gestes."
          text="Pas d’App Store. Juste Safari."
          titleClass="mt-[9px] text-34 leading-9 tracking-[-1px] xl:mt-3 xl:text-[52px] xl:leading-[55px] xl:tracking-[-2px]"
          textClass="mt-2.5 xl:mt-0"
        />
      </div>
      <div className="relative mt-8 xl:mt-12">
        <ol className="flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 [scrollbar-width:none] xl:mx-auto xl:max-w-[1240px] xl:justify-between xl:gap-0 xl:overflow-visible">
          <li className="hidden h-[360px] w-[274px] shrink-0 flex-col items-center rounded-[26px] bg-white pt-8 shadow-site-raised ring-1 ring-black/8 ring-inset xl:flex">
            <AppQr value={`https://${host}`} size={200} radius={0} />
            <p className="mt-[30px] text-18 leading-[22px] font-bold">Scannez avec l’iPhone</p>
            <p className="mt-2 text-14 leading-[21px] text-site-muted">
              Visez-le avec l’appareil photo.
            </p>
            <p className="mt-[5px] font-mono text-13 leading-4 font-semibold text-blue">{host}</p>
          </li>
          {GESTURES.map((g, i) => (
            <GestureCard key={g.title} index={i + 1} {...g} />
          ))}
        </ol>
        {/* Tells the thumb the row scrolls: the next card fades out. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-2.5 right-0 h-[380px] w-14 bg-linear-to-r from-white/0 to-white xl:hidden"
        />
      </div>
      <div aria-hidden="true" className="mt-5 flex justify-center gap-2 xl:hidden">
        <span className="h-2 w-5 rounded-full bg-site-ink" />
        <span className="size-2 rounded-full bg-site-fill-2" />
        <span className="size-2 rounded-full bg-site-fill-2" />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Closing and footer                                                         */
/* -------------------------------------------------------------------------- */

function Closing({ host }: { host: string }) {
  return (
    <section className={cn(CONTAINER, 'mt-9 xl:mt-24')}>
      <a
        href="#installation"
        className="flex h-14 items-center justify-center rounded-full bg-site-ink text-17 leading-[21px] font-semibold text-white xl:hidden"
      >
        Installer l’app
      </a>
      <p className="mt-4 px-3 text-center text-13 leading-4 text-site-subtle xl:hidden">
        Déjà installée ? Ouvrez-la depuis l’écran d’accueil.
      </p>
      <div className="relative hidden h-[220px] rounded-[32px] bg-linear-to-br from-site-fill via-site-kraft-wash via-60% to-site-kraft-wash-2 pt-[60px] pl-14 xl:block">
        <h2 className="text-[40px] leading-[48px] font-bold tracking-[-1.4px]">
          Prêt pour le prochain lot ?
        </h2>
        <p className="mt-2 text-17 leading-[26px] text-site-muted">
          Installez Courrier. Le prochain colis vous attend.
        </p>
        <div className="absolute top-10 right-9 flex gap-6">
          <p className="mt-[52px] text-right text-15 leading-[18px]">
            <span className="block font-semibold">Scannez pour ouvrir</span>
            <span className="mt-1 block text-site-muted">sur l’iPhone →</span>
          </p>
          <AppQr value={`https://${host}`} size={140} radius={14} />
        </div>
      </div>
    </section>
  );
}

function Footer({ version }: { version: string }) {
  return (
    <footer className={cn(CONTAINER, 'pb-10 xl:pb-[60px]')}>
      <div className="mt-[62px] h-px bg-black/10 xl:mt-20" />
      <div className="mt-[27px] grid xl:mt-[35px] xl:grid-cols-[1fr_auto] xl:items-center">
        <AppBrand size="footer" />
        <p className="mt-5 text-13 leading-4 text-site-subtle xl:col-start-1 xl:mt-6 xl:text-14 xl:leading-[17px]">
          Service courrier
        </p>
        <p className="mt-1 text-13 leading-4 text-muted-2 xl:col-start-2 xl:row-start-1 xl:mt-0 xl:text-14 xl:leading-[17px]">
          Usage interne · Version {version}
        </p>
      </div>
    </footer>
  );
}

export type LandingScreenProps = {
  /** Where the app lives, printed under the QR code. */
  host?: string;
  version?: string;
};

export function LandingScreen({ host = 'courrier.ysl.fr', version = '1.0' }: LandingScreenProps) {
  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-white text-site-ink">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 hidden h-[900px] bg-linear-to-b from-site-wash via-site-wash-2 via-55% to-white xl:block"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-[353px] bg-linear-to-b from-white via-site-fill via-55% to-site-fill xl:h-[521px] xl:via-70%"
      />
      <Hero host={host} />
      <main>
        <Journey />
        <Offline />
        <Install host={host} />
        <Closing host={host} />
      </main>
      <Footer version={version} />
    </div>
  );
}
