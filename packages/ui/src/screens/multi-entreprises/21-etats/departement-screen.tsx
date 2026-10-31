import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import { DeskTabs } from '#components/desk-tabs';
import { IconButton } from '#components/icon-button';
import { NavBar } from '#components/nav-bar';
import { PhoneRow } from '#components/phone-parts';
import { Screen } from '#components/screen';
import { Skeleton } from '#components/skeleton';
import { ACCOUNT, COMPANY, crumbs, DEPARTMENT_NAV } from '#fixtures/multi-entreprises';
import { Icon } from '#icons';
import {
  OfflineBanner,
  PhoneDock,
  RetryHero,
  RootHeader,
  RowTile,
  SkeletonRows,
  StateHero,
} from '#screens/multi-entreprises/21-etats/etats-parts';

const ROOT = 'pt-[calc(var(--safe-top)+6px)]';
const DOCK = <PhoneDock icon="qr" label="Remettre" />;

/** The parcels of the department while they load. */
export function ColisChargementMobile() {
  return (
    <Screen className={ROOT} bottom={DOCK}>
      <RootHeader title="Colis" />
      <Skeleton width={180} height={14} radius={6} className="mt-[18px]" />
      <SkeletonRows count={6} pitch={76} className="mt-[42px]" />
    </Screen>
  );
}

function WaitingHandovers() {
  return (
    <div className="mt-[21px]">
      <PhoneRow
        height={76}
        leading={<RowTile icon="clock" />}
        title="Camille Morel"
        lines={['UPS ···0622', 'Remis à 11:20 · en attente d’envoi']}
        separator
      />
      <PhoneRow
        height={76}
        leading={<RowTile icon="clock" />}
        title="Hugo Lefèvre"
        lines={['DHL ···7112', 'Remis à 11:24 · en attente d’envoi']}
      />
    </div>
  );
}

/** Handovers kept on the phone while the server does not answer. */
export function ColisErreurMobile() {
  return (
    <Screen className={ROOT} bottom={DOCK}>
      <RootHeader pill="unsent" title="Colis" subtitle="Studio · 12 présents" />
      <OfflineBanner
        className="mt-3.5"
        title="2 remises en attente d’envoi"
        text="Le serveur ne répond pas. Les remises restent sur ce téléphone et repartiront seules."
      />
      <WaitingHandovers />
    </Screen>
  );
}

/** The parcels on the computer, when they could not load. */
export function ColisErreurDesktop() {
  return (
    <CompanyShell
      company={COMPANY.studio}
      nav={DEPARTMENT_NAV}
      active="colis"
      account={ACCOUNT.department}
      breadcrumb={crumbs('Studio', 'Colis')}
    >
      <DeskPageHeader title="Colis" subtitle="Liste non chargée" />
      <RetryHero top={248} className="right-0" />
    </CompanyShell>
  );
}

/** Handovers kept on the phone, off the network. */
export function ColisHorsLigneMobile() {
  return (
    <Screen className={ROOT} bottom={DOCK}>
      <RootHeader pill="offline" title="Colis" subtitle="Studio · 12 présents" />
      <OfflineBanner
        className="mt-3.5"
        title="2 remises en attente d’envoi"
        text="Les remises marchent hors ligne. Elles partiront au retour du réseau."
      />
      <WaitingHandovers />
    </Screen>
  );
}

/** No parcel left in the department. */
export function ColisVideMobile() {
  return (
    <Screen className={ROOT} bottom={DOCK}>
      <RootHeader pill="synced" title="Colis" subtitle="Studio" />
      <StateHero
        top={260}
        icon="inbox"
        title="Tout est remis"
        text="Les colis en route vers le Studio apparaîtront ici."
        action={<span className="text-15 font-semibold">Voir l’historique</span>}
      />
    </Screen>
  );
}

/** No parcel on the computer. */
export function ColisVideDesktop() {
  return (
    <CompanyShell
      company={COMPANY.studio}
      nav={DEPARTMENT_NAV}
      active="colis"
      account={ACCOUNT.department}
      breadcrumb={crumbs('Studio', 'Colis')}
    >
      <DeskPageHeader title="Colis" subtitle="Studio · Bât. A, 2e étage, accueil" />
      <DeskTabs
        label="Colis du département"
        active="presents"
        className="mt-2"
        tabs={[
          { id: 'a-venir', label: 'À venir 0', width: 53 },
          { id: 'presents', label: 'Présents 0', width: 68 },
          { id: 'historique', label: 'Historique' },
        ]}
      />
      <div className="absolute inset-x-0 top-[248px] flex flex-col items-center text-center">
        <span className="flex size-[72px] items-center justify-center rounded-full bg-fill">
          <Icon name="inbox" size={32} />
        </span>
        <h2 className="mt-5 text-18 font-bold">Aucun colis au Studio</h2>
        <p className="relative -top-px mt-2 text-13 text-muted">
          Les colis scannés par la navette apparaissent dans « À venir », puis ici une fois
          déposés.
        </p>
      </div>
    </CompanyShell>
  );
}

/** Counting a deposit off the network: the confirmation waits on the phone. */
export function ConfirmerHorsLigneMobile() {
  return (
    <Screen
      bottom={
        <BottomBar surface="plain" className="pt-6 pb-9">
          <Button block>Confirmer 6 colis</Button>
        </BottomBar>
      }
    >
      <NavBar
        title="Dépôt de Karim"
        leading={<IconButton icon="x" label="Fermer" size="lg" iconSize={22} className="-ml-0.5" />}
      />
      <OfflineBanner
        className="mt-3"
        title="Hors ligne"
        text="Votre confirmation est gardée et partira au retour du réseau. Les e-mails partiront à ce moment-là."
      />
      <div className="mt-[35px] flex h-24 items-center justify-center">
        <button
          type="button"
          aria-label="Moins"
          className="relative size-12 rounded-full bg-fill"
        >
          <span className="absolute top-[23px] left-[15px] h-[2.5px] w-[18px] rounded-[1px] bg-ink" />
        </button>
        <output className="w-[164px] text-center text-[80px] leading-[96px] font-bold tracking-[-2px]">
          6
        </output>
        <button
          type="button"
          aria-label="Plus"
          className="relative size-12 rounded-full bg-fill"
        >
          <span className="absolute top-[23px] left-[15px] h-[2.5px] w-[18px] rounded-[1px] bg-ink" />
          <span className="absolute top-[15px] left-[22.75px] h-[18px] w-[2.5px] rounded-[1px] bg-ink" />
        </button>
      </div>
      <p className="mt-2 text-center text-17 font-semibold">colis comptés</p>
    </Screen>
  );
}
