import type { ReactNode } from 'react';

import { Avatar } from '#components/avatar';
import { Banner } from '#components/banner';
import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import {
  DeskTable,
  DeskTablePagination,
  type DeskTableColumn,
} from '#components/desk-table';
import { DeskTabs } from '#components/desk-tabs';
import { GroupedFootnote, GroupedHeader, GroupedList } from '#components/grouped-list';
import { ListRow } from '#components/list-row';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { SegmentedControl } from '#components/segmented-control';
import {
  ACCOUNT,
  COMPANY,
  crumbs,
  DEPARTMENT_NAV,
  withNavItem,
} from '#fixtures/multi-entreprises';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

type SentState = 'delivered' | 'opened' | 'bounced';

type SentMail = {
  id: string;
  recipient: string;
  email: string;
  message: string;
  state: SentState;
  parcel: string;
  sentAt: string;
};

export const SENT_MAILS: SentMail[] = [
  {
    id: 'camille',
    recipient: 'Camille Morel',
    email: 'camille.morel@atelier-lumen.fr',
    message: 'Avis de retrait',
    state: 'delivered',
    parcel: 'COL-2418',
    sentAt: '10:58',
  },
  {
    id: 'samuel',
    recipient: 'Samuel Petit',
    email: 'samuel.petit@atelier-lumen.fr',
    message: 'Avis de retrait',
    state: 'opened',
    parcel: 'COL-2417',
    sentAt: '10:58',
  },
  {
    id: 'hugo',
    recipient: 'Hugo Lefèvre',
    email: 'hugo.lefevre@atelier-lumen.fr',
    message: 'Avis de retrait',
    state: 'delivered',
    parcel: 'COL-2416',
    sentAt: '10:58',
  },
  {
    id: 'paul',
    recipient: 'Paul Roy',
    email: 'paul.roy@atelier-lumen.f',
    message: 'Avis de retrait',
    state: 'bounced',
    parcel: 'COL-2415',
    sentAt: '10:58',
  },
  {
    id: 'ines',
    recipient: 'Inès Garnier',
    email: 'ines.garnier@atelier-lumen.fr',
    message: 'Relance J+2',
    state: 'delivered',
    parcel: 'COL-2391',
    sentAt: '9:00',
  },
];

const STATE: Record<
  SentState,
  {
    label: string;
    tone: string;
    deskIcon: IconName;
    phoneIcon: IconName;
    deskWidth: number;
  }
> = {
  delivered: {
    label: 'Délivré',
    tone: 'bg-green-soft text-green',
    deskIcon: 'check',
    phoneIcon: 'check',
    deskWidth: 76.2,
  },
  opened: {
    label: 'Ouvert',
    tone: 'bg-green-soft text-green',
    deskIcon: 'eye',
    phoneIcon: 'eye',
    deskWidth: 69.6,
  },
  bounced: {
    label: 'Rebond',
    tone: 'bg-red-soft text-red',
    deskIcon: 'warning',
    phoneIcon: 'alert',
    deskWidth: 69.6,
  },
};

function DeskStateTag({ state }: { state: SentState }) {
  const { label, tone, deskIcon, deskWidth } = STATE[state];
  return (
    <span
      className={cn(
        'mt-[2.5px] flex h-[22px] items-center gap-1 rounded-[4px] pl-1.5 text-12 font-medium',
        tone,
      )}
      style={{ width: deskWidth }}
    >
      <Icon name={deskIcon} size={14} className="shrink-0" />
      <span className="-mt-0.5">{label}</span>
    </span>
  );
}

function DeskMailFilter({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-8 shrink-0 cursor-pointer items-center rounded-[6px] border border-border bg-surface pl-[9px] text-13 whitespace-nowrap outline-none',
        'focus-visible:ring-2 focus-visible:ring-blue',
        className,
      )}
    >
      <Icon name="filter" size={14} className="mr-1.5 text-muted" />
      <span className="text-muted">{label}</span>
      <span className="ml-[6.5px] font-semibold">{value}</span>
      <Icon name="chevron" size={10} className="ml-2.5 rotate-90 text-muted" />
    </button>
  );
}

function CountedTab({
  label,
  count,
  current = false,
}: {
  label: string;
  count: number;
  current?: boolean;
}) {
  return (
    <span className={cn('flex', !current && 'font-medium')}>
      {label}
      <span
        className={cn(
          'mt-px ml-1.5 flex h-[18px] w-5 items-center justify-center rounded-full pb-px text-11 font-semibold',
          current ? 'bg-ink text-on-ink' : 'bg-fill text-muted',
        )}
      >
        {count}
      </span>
    </span>
  );
}

const COLUMNS: DeskTableColumn<SentMail>[] = [
  {
    key: 'recipient',
    header: 'Destinataire',
    width: 230,
    cell: (m) => <span className="mt-[2px] font-semibold">{m.recipient}</span>,
  },
  {
    key: 'email',
    header: 'E-mail',
    width: 300,
    cell: (m) => <span className="mt-[2px] text-ink-2">{m.email}</span>,
  },
  { key: 'message', header: 'Message', width: 200, cell: (m) => <span className="mt-[2px]">{m.message}</span> },
  {
    key: 'state',
    header: 'Statut',
    width: 180,
    cell: (m) => <DeskStateTag state={m.state} />,
  },
  {
    key: 'parcel',
    header: 'Colis',
    width: 170,
    cell: (m) => <span className="mt-0.5 font-mono text-12">{m.parcel}</span>,
  },
  {
    key: 'sent',
    header: <span className="block pl-[9px]">Envoyé</span>,
    width: 48,
    cell: (m) => (
      <span
        className={cn(
          'mt-[2px] text-muted',
          m.sentAt.length > 4 ? 'ml-[18px]' : 'ml-[22px]',
        )}
      >
        {m.sentAt}
      </span>
    ),
  },
];

/** What the department sent today and what the sending server says of it. */
export function SuiviEmailsDesktop({ mails }: { mails: SentMail[] }) {
  return (
    <CompanyShell
      company={COMPANY.studio}
      nav={withNavItem(DEPARTMENT_NAV, 'e-mails', {
        count: 1,
        countTone: 'red',
      })}
      active="e-mails"
      account={ACCOUNT.department}
      breadcrumb={crumbs('Studio', 'E-mails', 'Envoyés')}
      searchPlaceholder="Nom, e-mail"
    >
      <DeskPageHeader
        title="E-mails"
        subtitle="Avis et relances envoyés aux salariés du Studio"
        actions={
          <Button
            variant="outline"
            size="desk"
            icon="download"
            className="w-[104px] justify-start"
          >
            Exporter
          </Button>
        }
      />
      <DeskTabs
        label="E-mails du département"
        active="envoyes"
        className="mt-3"
        tabs={[
          {
            id: 'envoyes',
            label: <CountedTab label="Envoyés" count={5} current />,
            width: 79,
          },
          {
            id: 'a-corriger',
            label: <CountedTab label="À corriger" count={1} />,
            width: 87,
          },
          { id: 'reponses', label: <CountedTab label="Réponses" count={2} /> },
        ]}
      />
      <div className="mt-[19px] flex gap-2">
        <DeskMailFilter label="Période" value="Aujourd’hui" className="w-[177px]" />
        <DeskMailFilter label="Statut" value="Tous" className="w-[129px]" />
        <DeskMailFilter label="Message" value="Tous" className="w-[147px]" />
      </div>
      <DeskTable
        label="E-mails envoyés"
        className="mt-4 shrink-0"
        rowHeight={48}
        columns={COLUMNS}
        rows={mails}
        rowKey={(m) => m.id}
        footer={<DeskTablePagination range="1–5 sur 5" />}
      />
      <p className="mt-[11px] text-12 text-muted">
        Statuts donnés par le serveur d’envoi. Une adresse qui rebondit passe
        dans « À corriger ».
      </p>
    </CompanyShell>
  );
}

function PhoneRow({
  leading,
  title,
  line,
  state,
  separator = false,
}: {
  leading: ReactNode;
  title: string;
  line: string;
  state?: ReactNode;
  separator?: boolean;
}) {
  return (
    <div className="relative h-16 pt-[11px]">
      <ListRow
        leading={<span className="-mt-1.5 flex">{leading}</span>}
        title={title}
        lines={[{ text: <span className="relative -top-px">{line}</span> }]}
        trailing={
          <span className="-mt-0.5 flex items-center gap-2">
            {state}
            <Icon name="chevron" size={16} className="text-faint" />
          </span>
        }
      />
      {separator && (
        <div className="absolute inset-x-0 bottom-0 ml-[52px] h-px bg-separator" />
      )}
    </div>
  );
}

function PhoneStatePill({ state }: { state: SentState }) {
  const { label, tone, phoneIcon } = STATE[state];
  return (
    <span
      className={cn(
        'flex h-6 items-center gap-1 rounded-full pr-2.5 pl-2 text-13 font-semibold',
        tone,
      )}
    >
      <Icon name={phoneIcon} size={14} className="shrink-0" />
      <span className="-mt-0.5">{label}</span>
    </span>
  );
}

/** The same follow-up on the phone: one row per message, its state at the end. */
export function SuiviEmailsMobile({ mails }: { mails: SentMail[] }) {
  return (
    <Screen>
      <NavBar title="E-mails" />
      <SegmentedControl
        label="E-mails du département"
        options={['Envoyés', 'À corriger 1', 'Réponses 2']}
        value="Envoyés"
        className="mt-3 h-9 gap-0 rounded-full bg-fill-2 p-0.5 [&>button]:rounded-full [&>button]:pb-0.5 [&>button:not([aria-checked=true])]:text-ink-2"
      />
      <p className="relative -top-px mt-5 text-13 font-medium text-muted">
        Aujourd’hui
      </p>
      <div className="mt-2">
        {mails.map((mail) => (
          <PhoneRow
            key={mail.id}
            leading={
              <span className="flex size-10 items-center justify-center rounded-full bg-fill">
                <Icon name="mail" size={20} />
              </span>
            }
            title={mail.recipient}
            line={`${mail.message} · ${mail.sentAt}`}
            state={<PhoneStatePill state={mail.state} />}
            separator
          />
        ))}
      </div>
      <p className="relative -top-px mt-[18px] text-13 text-muted">
        Statuts donnés par le serveur d’envoi.
      </p>
    </Screen>
  );
}

function ParcelVignette() {
  return (
    <span
      aria-hidden="true"
      className="relative block size-10 rounded-[8px] bg-kraft"
    >
      <span className="absolute top-[8.8px] left-[7.2px] h-5 w-[25.6px] rounded-[2px] bg-paper" />
      <span className="absolute top-3 left-[10.4px] h-[1.5px] w-4 bg-[#666666]" />
      <span className="absolute top-[16.8px] left-[10.4px] h-[1.5px] w-4 bg-[#666666]" />
      <span className="absolute top-[22px] left-[10.4px] h-1 w-[19.2px] bg-[#111111]" />
    </span>
  );
}

function PhoneNotice({
  icon,
  title,
  description,
  tone = 'grey',
  className,
}: {
  icon: IconName;
  title: string;
  description: string;
  tone?: 'grey' | 'red';
  className: string;
}) {
  return (
    <Banner
      tone={tone}
      icon={icon}
      title={title}
      description={description}
      className={cn('items-start gap-2.5 rounded-[14px] py-0 pr-4 pl-4', className)}
      classNames={{
        icon: cn('mt-4', tone === 'grey' && 'text-ink-2'),
        title: 'mt-[15px] text-15',
        description: 'mt-[2.6px] max-w-[288px] text-13 leading-[15.6px]',
      }}
    />
  );
}

const STRANDED = [
  { name: 'Hugo Martin', line: '12 jours · relancé 2 fois' },
  { name: 'Inès Roche', line: '9 jours · relancée 1 fois' },
  { name: 'Paul Vidal', line: '8 jours · parti de l’entreprise ?' },
];

/** Parcels left too long, and the deadline before they go back. */
export function ColisEnSouffranceMobile() {
  return (
    <Screen
      bottom={
        <BottomBar surface="plain" className="pt-6 pb-9">
          <Button icon="send" iconSize={20} className="w-full gap-2">
            Relancer les 3 salariés
          </Button>
        </BottomBar>
      }
    >
      <NavBar title="En souffrance" />
      <p className="mt-3 text-15 text-muted">
        Studio · 3 colis de plus de 7 jours
      </p>
      <div className="mt-4">
        {STRANDED.map((row, i) => (
          <PhoneRow
            key={row.name}
            leading={<ParcelVignette />}
            title={row.name}
            line={row.line}
            separator={i < STRANDED.length - 1}
          />
        ))}
      </div>
      <PhoneNotice
        icon="info"
        title="Retour à l’expéditeur après 15 jours"
        description="Délai réglé par l’admin d’Atelier Lumen."
        className="mt-6 h-[67px]"
      />
    </Screen>
  );
}

/** A bounced notice: the address is fixed here and the notice goes out again. */
export function CorrigerAdresseMobile() {
  return (
    <Screen
      tone="fill"
      bottom={
        <BottomBar surface="line" className="pt-[23px] pb-9">
          <Button icon="send" iconSize={20} className="w-full gap-2">
            Corriger et renvoyer
          </Button>
        </BottomBar>
      }
    >
      <NavBar title="Paul Roy" />
      <PhoneNotice
        tone="red"
        icon="alert"
        title="L’e-mail est revenu"
        description="paul.roy@atelier-lumen.f : adresse inconnue (rebond à 10:59)."
        className="mt-3 h-[83px]"
      />
      <label>
        <span className="relative -top-px mt-[15px] block text-13 font-medium text-muted">
          Adresse corrigée
        </span>
        <input
          readOnly
          value="paul.roy@atelier-lumen.fr"
          className="mt-1.5 h-12 w-full rounded-[12px] bg-surface pl-3.5 shadow-[0_0_0_0.75px_var(--color-ink),inset_0_0_0_0.75px_var(--color-ink)] text-17 text-ink outline-none"
        />
      </label>
      <p className="relative -top-[0.4px] mt-5 w-[320px] self-start pl-4 text-13 leading-[15.6px] text-muted">
        Mise à jour dans l’annuaire du Studio. L’avis repart aussitôt.
      </p>
    </Screen>
  );
}

const ALTERNATIVES: { icon: IconName; label: string; value?: string }[] = [
  { icon: 'phone', label: 'Prévenir par téléphone', value: 'Poste 214' },
  { icon: 'users', label: 'Prévenir le référent Juridique' },
  { icon: 'edit', label: 'Ajouter son e-mail' },
];

/** A recipient the directory has no address for: the other ways to reach them. */
export function DestinataireSansEmailMobile() {
  return (
    <Screen>
      <NavBar title="Colis de Marc Lenoir" />
      <PhoneNotice
        tone="red"
        icon="mail"
        title="Pas d’e-mail dans l’annuaire"
        description="Marc Lenoir (Juridique) ne sera pas prévenu automatiquement."
        className="mt-3 h-[83px]"
      />
      <GroupedHeader className="relative -top-px mt-[25px]">Que faire ?</GroupedHeader>
      <GroupedList className="mt-1.5 rounded-[14px]">
        {ALTERNATIVES.map((row, i) => (
          <button
            key={row.label}
            type="button"
            className="relative flex h-[52px] w-full cursor-pointer items-center pr-3.5 pl-3.5 text-left text-16 outline-none focus-visible:ring-2 focus-visible:ring-blue"
          >
            <span className="flex size-7 items-center justify-center rounded-[7px] bg-muted text-white">
              <Icon name={row.icon} size={16} />
            </span>
            <span className="relative -top-[0.25px] ml-3.5 flex-1">{row.label}</span>
            {row.value && <span className="relative -top-[0.25px] mr-1.5 text-muted">{row.value}</span>}
            <Icon name="chevron" size={16} className="text-faint" />
            {i < ALTERNATIVES.length - 1 && (
              <span className="absolute inset-x-0 bottom-0 ml-14 h-px bg-separator" />
            )}
          </button>
        ))}
      </GroupedList>
      <GroupedFootnote className="relative -top-[0.4px] mt-[22px] px-0 leading-[15.6px]">
        L’annuaire du Juridique est tenu par son responsable ; l’ajout lui est
        envoyé pour validation.
      </GroupedFootnote>
    </Screen>
  );
}

const REPLIES = [
  { initials: 'LF', name: 'Léa Fontaine', quote: '« Je passe à 14 h »' },
  {
    initials: 'YM',
    name: 'Yanis Morel',
    quote: '« Pouvez-vous le garder jusqu’à lundi ? »',
  },
  {
    initials: 'SB',
    name: 'Sofia Bensaïd',
    quote: '« Mon collègue Tom le récupère »',
  },
];

/** What employees answered, to their own department only. */
export function ReponsesSalariesMobile() {
  return (
    <Screen>
      <NavBar title="Réponses" />
      <p className="mt-3 text-15 text-muted">Finance · aujourd’hui</p>
      <div className="mt-4">
        {REPLIES.map((row, i) => (
          <PhoneRow
            key={row.name}
            leading={
              <Avatar
                initials={row.initials}
                tone="fill"
                className="rounded-full bg-fill-2 text-14"
              />
            }
            title={row.name}
            line={row.quote}
            separator={i < REPLIES.length - 1}
          />
        ))}
      </div>
      <PhoneNotice
        icon="inbox"
        title="Seules les réponses de Finance"
        description="Les autres départements voient les leurs."
        className="mt-6 h-[67px]"
      />
    </Screen>
  );
}
