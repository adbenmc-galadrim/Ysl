import type { ReactNode } from 'react';

import { Button } from '#components/button';
import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import { IconButton } from '#components/icon-button';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { SegmentedControl } from '#components/segmented-control';
import { Skeleton } from '#components/skeleton';
import { StatusPill } from '#components/status-pill';
import { ACCOUNT, COMPANY, COMPANY_ADMIN_NAV, crumbs } from '#fixtures/multi-entreprises';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';
import { PhoneFigure } from '#screens/multi-entreprises/19-rapports/rapports-screen';
import {
  HeroButton,
  OfflineBanner,
  PersonAvatar,
  PhoneRow,
  ProgressTrack,
  RetryHero,
  RootHeader,
  RowTile,
  SkeletonRows,
  StateHero,
} from '#screens/multi-entreprises/21-etats/etats-parts';

const ROOT = 'pt-[calc(var(--safe-top)+6px)]';

function AdminDesktop({
  active,
  label,
  title,
  subtitle,
  children,
}: {
  active: string;
  label: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <CompanyShell
      company={COMPANY.admin}
      nav={COMPANY_ADMIN_NAV}
      active={active}
      account={ACCOUNT.companyAdmin}
      breadcrumb={crumbs('Atelier Lumen', label)}
    >
      <DeskPageHeader title={title} subtitle={subtitle} />
      {children}
    </CompanyShell>
  );
}

/** The directory while it loads. */
export function AnnuaireChargementMobile() {
  return (
    <Screen>
      <NavBar title="Annuaire" />
      <Skeleton width={353} height={44} radius={12} className="mt-4" />
      <SkeletonRows count={8} pitch={64} className="mt-8" />
    </Screen>
  );
}

const DIRECTORY = [
  { name: 'Camille Morel', initials: 'CM', department: 'Studio' },
  { name: 'Claire Robin', initials: 'CR', department: 'Finance' },
  { name: 'Hélène Dubois', initials: 'HD', department: 'Finance' },
  { name: 'Hugo Lefèvre', initials: 'HL', department: 'Studio', waiting: true },
];

function DirectoryRows() {
  return (
    <div className="mt-[17px]">
      {DIRECTORY.map((person) => (
        <PhoneRow
          key={person.name}
          height={64}
          leading={<PersonAvatar initials={person.initials} />}
          title={person.name}
          lines={[person.department]}
          separator
          before={
            person.waiting && (
              <StatusPill
                icon="clock"
                label="En attente d’envoi"
                size="sm"
                className="h-6 w-[141px]"
              />
            )
          }
        />
      ))}
    </div>
  );
}

/** The directory's last copy, when the server does not answer. */
export function AnnuaireErreurMobile() {
  return (
    <Screen>
      <NavBar title="Annuaire" />
      <OfflineBanner
        className="mt-4"
        title="Annuaire du 29 oct., 8:00 · non mis à jour"
        text="Le serveur ne répond pas. Cette copie reste consultable ; les ajouts et déplacements attendent."
      />
      <DirectoryRows />
    </Screen>
  );
}

/** The directory on the computer, when it could not load. */
export function AnnuaireErreurDesktop() {
  return (
    <AdminDesktop active="annuaire" label="Annuaire" title="Annuaire" subtitle="Liste non chargée">
      <RetryHero top={248} className="right-0" />
    </AdminDesktop>
  );
}

/** The directory's copy on the phone, off the network. */
export function AnnuaireHorsLigneMobile() {
  return (
    <Screen>
      <NavBar title="Annuaire" />
      <OfflineBanner
        className="mt-4"
        title="Hors ligne · annuaire du 29 oct., 8:00"
        text="La recherche marche. Ajouts et déplacements partiront au retour du réseau."
      />
      <DirectoryRows />
    </Screen>
  );
}

/** The empty directory on the computer: drop the export of the HR tool. */
export function AnnuaireVideDesktop() {
  return (
    <AdminDesktop
      active="annuaire"
      label="Annuaire"
      title="Annuaire"
      subtitle="Aucun salarié pour l’instant"
    >
      <div className="relative mx-auto mt-24 flex h-[300px] w-[752px] shrink-0 flex-col items-center rounded-desk border-[1.5px] border-dashed border-border bg-sidebar pt-[46.5px]">
        <span className="flex size-16 items-center justify-center rounded-full bg-surface">
          <Icon name="upload" size={28} />
        </span>
        <h2 className="mt-5 text-18 font-bold">Déposez l’export CSV de votre annuaire</h2>
        <p className="relative -top-px mt-2 text-13 text-muted">
          Nom, prénom, e-mail et département suffisent. Les colonnes sont reconnues seules.
        </p>
        <Button size="desk" className="mt-7 w-40">
          Choisir un fichier
        </Button>
      </div>
      <p className="relative -top-px mt-7 text-center text-13 text-muted">
        Ou ajoutez les salariés un par un, ou laissez chaque département tenir le sien.
      </p>
    </AdminDesktop>
  );
}

const INVITE = (
  <IconButton
    icon="userPlus"
    label="Inviter un compte"
    size="lg"
    iconSize={22}
    disabled
    className="opacity-40"
  />
);

/** The accounts list, when it could not load. */
export function ComptesErreurMobile() {
  return (
    <Screen>
      <NavBar title="Comptes" trailing={INVITE} />
      <RetryHero top={260} />
    </Screen>
  );
}

const ACCOUNTS = [
  { name: 'Karim Daoud', initials: 'KD', role: 'Navette · Service courrier' },
  { name: 'Sophie Lambert', initials: 'SL', role: 'Navette · Service courrier' },
  { name: 'Julie Perrin', initials: 'JP', role: 'Département · Studio' },
  { name: 'Thomas Moreau', initials: 'TM', role: 'Département · Studio' },
  { name: 'Nadia Kessler', initials: 'NK', role: 'Département · Finance' },
  { name: 'Bruno Vidal', initials: 'BV', role: 'Département · Juridique' },
];

/** The accounts list off the network: read only. */
export function ComptesHorsLigneMobile() {
  return (
    <Screen>
      <NavBar title="Comptes" trailing={INVITE} />
      <OfflineBanner
        className="mt-4"
        title="Hors ligne"
        text="La liste date de 9:40. Inviter et suspendre reviendront avec le réseau."
      />
      <div className="mt-[11px]">
        {ACCOUNTS.map((person) => (
          <PhoneRow
            key={person.name}
            height={64}
            leading={<PersonAvatar initials={person.initials} />}
            title={person.name}
            lines={[person.role]}
            separator
          />
        ))}
      </div>
    </Screen>
  );
}

/** The company administrator, alone so far. */
export function ComptesVideMobile() {
  return (
    <Screen>
      <NavBar title="Comptes" />
      <StateHero
        top={230}
        icon="users"
        title="Vous êtes seule pour l’instant"
        text="Invitez vos navettes, puis un compte par département."
        textWidth={320}
        action={
          <HeroButton icon="userPlus" width={230}>
            Inviter un compte
          </HeroButton>
        }
      />
    </Screen>
  );
}

/** The mailroom alone: the department a company starts with. */
export function DepartementsVideMobile() {
  return (
    <Screen>
      <NavBar title="Départements" />
      <div className="mt-4">
        <PhoneRow
          height={72}
          leading={<RowTile icon="truck" />}
          title="Service courrier"
          lines={['Rez-de-chaussée, quai']}
        />
      </div>
      <StateHero
        top={280}
        icon="building"
        title="Aucun autre département"
        text="Créez un département par point de réception : il aura ses comptes, son annuaire et son QR."
        textWidth={310}
        action={
          <HeroButton icon="plus" width={240}>
            Nouveau département
          </HeroButton>
        }
      />
    </Screen>
  );
}

type Requirement = 'Désactivée' | 'Facultative' | 'Obligatoire';

const STEPS: { title: string; text: string; value: Requirement }[] = [
  { title: 'Preuve par QR ou code', text: 'Le salarié présente le QR ou le code de son e-mail', value: 'Obligatoire' },
  { title: 'Scan du colis', text: 'Chaque colis remis est scanné', value: 'Facultative' },
  { title: 'Signature', text: 'Le salarié signe sur l’écran', value: 'Obligatoire' },
  { title: 'Photo', text: 'Photo du colis remis', value: 'Désactivée' },
  { title: 'Retrait par un collègue', text: 'Un collègue peut retirer à la place du salarié', value: 'Facultative' },
];

const REQUIREMENTS: Requirement[] = ['Désactivée', 'Facultative', 'Obligatoire'];

/** The handover rules off the network: shown, veiled, not editable. */
export function FonctionnementHorsLigneMobile() {
  return (
    <Screen tone="fill">
      <NavBar title="Fonctionnement" />
      <OfflineBanner
        className="mt-4"
        title="Hors ligne"
        text="Le fonctionnement se change en ligne : il faut compter les colis touchés."
      />
      <h2 className="relative -top-px mt-[17px] px-4 text-13 font-medium text-muted">Remise</h2>
      <div className="relative mt-1.5 h-[590px] rounded-[14px] bg-surface after:absolute after:inset-x-0 after:top-0 after:h-[600px] after:bg-fill/45">
        {STEPS.map((step, i) => (
          <div key={step.title} className="relative h-[118px] px-4 pt-3.5">
            <p className="text-16 font-semibold">{step.title}</p>
            <p className="relative -top-px mt-1 text-13 text-muted">{step.text}</p>
            <SegmentedControl
              label={step.title}
              value={step.value}
              options={REQUIREMENTS}
              className="mt-[7px] h-11 gap-0 rounded-[22px] bg-fill-2 p-0.5 [&_button]:h-10 [&_button]:pb-[3px] [&_button:not([aria-checked=true])]:text-ink-2"
            />
            {i < STEPS.length - 1 && (
              <span className="absolute inset-x-4 bottom-0 h-px bg-separator" />
            )}
          </div>
        ))}
      </div>
    </Screen>
  );
}

/** The reports before the first parcel. */
export function RapportsVideMobile() {
  return (
    <Screen>
      <NavBar title="Rapports" />
      <StateHero
        top={240}
        icon="chart"
        title="Pas encore de chiffres"
        text="Les rapports se remplissent dès les premiers colis reçus."
      />
    </Screen>
  );
}

/** The company overview while it loads. */
export function VueChargementMobile() {
  return (
    <Screen tone="fill" className={ROOT}>
      <RootHeader title="Vue d’ensemble" menuClass="bg-surface" />
      <div className="mt-[38px] grid grid-cols-[171px_171px] gap-x-[11px] gap-y-3">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-20 rounded-[14px] bg-surface" />
        ))}
      </div>
      <SkeletonRows count={3} pitch={64} className="mt-[54px]" />
    </Screen>
  );
}

/** The company overview, with figures that have not been refreshed. */
export function VueErreurMobile() {
  return (
    <Screen tone="fill" className={ROOT}>
      <RootHeader title="Vue d’ensemble" subtitle="Chiffres de 9:12" menuClass="bg-surface" />
      <OfflineBanner
        className="mt-3.5"
        title="Chiffres non mis à jour"
        text="Le serveur ne répond pas. Ceux-ci datent de 9:12."
        action="Réessayer"
      />
      <div className="mt-[27px] grid grid-cols-[171px_171px] gap-x-[11px] gap-y-3">
        <PhoneFigure value="12" label="En route" className="bg-surface opacity-60" />
        <PhoneFigure value="35" label="En attente" className="bg-surface opacity-60" />
        <PhoneFigure value="5" label="En souffrance" className="bg-surface opacity-60" />
        <PhoneFigure value="2" label="À régulariser" className="bg-surface opacity-60" />
      </div>
    </Screen>
  );
}

/** The overview on the computer, when it could not load. */
export function VueErreurDesktop() {
  return (
    <AdminDesktop
      active="vue-d-ensemble"
      label="Vue d’ensemble"
      title="Vue d’ensemble"
      subtitle="Chiffres non chargés"
    >
      <RetryHero top={248} className="right-0" />
    </AdminDesktop>
  );
}

function SetupStep({
  icon,
  tileClass,
  title,
  text,
  end,
}: {
  icon: IconName;
  tileClass?: string;
  title: string;
  text: string;
  end: ReactNode;
}) {
  return (
    <div className="relative h-24 w-[760px] rounded-desk border border-separator pt-[23px] pl-[15px]">
      <div className="flex items-start">
        <span className={cn('flex size-12 items-center justify-center rounded-[10px] bg-fill', tileClass)}>
          <Icon name={icon} size={22} />
        </span>
        <div className="ml-4">
          <p className="text-15 font-semibold">{title}</p>
          <p className="relative -top-px mt-1.5 text-13 text-muted">{text}</p>
        </div>
      </div>
      {end}
    </div>
  );
}

/** The first visit of a company administrator: three steps to the first parcel. */
export function VueNouvelleEntrepriseDesktop() {
  return (
    <AdminDesktop
      active="vue-d-ensemble"
      label="Vue d’ensemble"
      title="Bienvenue, Claire"
      subtitle="Trois étapes avant le premier colis"
    >
      <div className="mt-2 flex flex-col gap-3">
        <SetupStep
          icon="check"
          tileClass="bg-green-soft text-green"
          title="1. Créer vos départements"
          text="Un par point de réception, avec son lieu et ses horaires."
          end={
            <p className="absolute top-[35px] right-[15px] text-13 font-medium text-green">
              Fait · 3 départements
            </p>
          }
        />
        <SetupStep
          icon="users"
          title="2. Importer l’annuaire"
          text="Le CSV de votre DSI, ou laissez chaque département tenir le sien."
          end={
            <Button size="desk" className="absolute top-[31px] right-[15px] w-[140px]">
              Importer un CSV
            </Button>
          }
        />
        <SetupStep
          icon="userPlus"
          title="3. Inviter navettes et départements"
          text="Chacun reçoit un e-mail et choisit son mot de passe."
          end={
            <Button variant="outline" size="desk" className="absolute top-[31px] right-[15px] w-[140px]">
              Inviter
            </Button>
          }
        />
      </div>
      <ProgressTrack value={1 / 3} className="mt-8 w-[760px]" />
      <p className="mt-2.5 text-12 text-muted">1 sur 3 fait</p>
    </AdminDesktop>
  );
}
