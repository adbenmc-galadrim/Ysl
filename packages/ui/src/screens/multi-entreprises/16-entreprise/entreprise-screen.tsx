import { Avatar } from '#components/avatar';
import { Banner } from '#components/banner';
import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { CompanySettingsDesk } from '#components/company-parts';
import { DeskFormRow, DeskInput, DeskSectionTitle } from '#components/desk-form';
import { DeskPanel } from '#components/desk-panel';
import { DeskTable, type DeskTableColumn } from '#components/desk-table';
import {
  PhoneGroup,
  PhoneGroupTitle,
  PhoneSettingRow,
  PhoneSettings,
} from '#components/phone-parts';
import { StatusDot } from '#components/status-dot';
import { StatusPill } from '#components/status-pill';
import { COMPANY, companySettingsShell } from '#fixtures/multi-entreprises';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

type DnsRecord = {
  name: string;
  value: string;
  state: 'green' | 'orange' | 'grey';
  stateLabel: string;
};

const DNS_COLUMNS: DeskTableColumn<DnsRecord>[] = [
  {
    key: 'type',
    header: 'Type',
    width: 70,
    cell: () => <span className="font-semibold">TXT</span>,
  },
  {
    key: 'name',
    header: 'Nom',
    width: 190,
    cell: (r) => <span className="mt-0.5 font-mono text-12">{r.name}</span>,
  },
  {
    key: 'value',
    header: 'Valeur',
    width: 710,
    cell: (r) => (
      <span className="mt-0.5 font-mono text-12 whitespace-pre">{r.value}</span>
    ),
  },
  {
    key: 'state',
    header: 'État',
    cell: (r) => (
      <StatusDot
        size="sm"
        tone={r.state}
        label={r.stateLabel}
        className={r.state === 'grey' ? '[&>span:first-child]:bg-muted' : undefined}
      />
    ),
  },
];

const SPF = 'v=spf1 include:spf.brevo.com ~all';
const DKIM = 'k=rsa; p=MIGfMA0GCSqGSIb3DQEB…QIDAQAB';

/** Identity and sender of a company whose domain still has to be verified. */
export function IdentiteDomaineAVerifierDesktop() {
  return (
    <CompanySettingsDesk tab="identity" shell={companySettingsShell('Identité et e-mails')}>
      <DeskSectionTitle
        className="mt-[19px]"
        title="Identité"
        description="Affichée dans l’app et en tête des e-mails. Le reste de l’interface reste neutre."
      />
      <DeskFormRow label="Nom" className="mt-[18px]">
        <DeskInput label="Nom" defaultValue="Atelier Lumen" />
      </DeskFormRow>
      <DeskFormRow
        label="Logo"
        hint="PNG ou SVG carré, 512 px conseillés"
        className="mt-4 h-14 [&>div:first-child]:pt-2"
      >
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[10px] bg-ink text-22 font-bold text-on-ink">
          AL
        </span>
        <Button variant="outline" size="desk" className="mt-3 ml-4 w-24">
          Remplacer
        </Button>
        <Button
          variant="secondary"
          size="desk"
          className="mt-3 ml-2 w-[76px] bg-transparent text-ink-2"
        >
          Retirer
        </Button>
      </DeskFormRow>
      <div className="mt-6 h-px shrink-0 bg-separator" />
      <DeskSectionTitle
        className="mt-[23px]"
        title="Expéditeur des e-mails"
        description="Avis de retrait, relances et invitations partent du serveur avec cette adresse."
      />
      <DeskFormRow label="Nom affiché" className="mt-[18px]">
        <DeskInput label="Nom affiché" defaultValue="Courrier Atelier Lumen" />
      </DeskFormRow>
      <DeskFormRow
        label="Adresse"
        hint="Les réponses arrivent au département du colis"
        className="mt-3 h-8"
      >
        <DeskInput label="Adresse" defaultValue="courrier@atelier-lumen.fr" />
      </DeskFormRow>
      <Banner
        tone="orange"
        icon="alert"
        iconSize={18}
        title="Domaine atelier-lumen.fr pas encore vérifié"
        description="En attendant, les e-mails partent de notifications@courrier.app au nom de « Courrier Atelier Lumen ». Transmettez ces deux enregistrements à votre DSI."
        className="mt-7 h-16 shrink-0 items-start gap-2.5 rounded-desk py-0 pr-4 pl-4"
        classNames={{
          icon: 'mt-3.5',
          title: 'mt-[12.5px] h-[17px] text-14',
          description: 'mt-[3.5px] text-13 leading-4 whitespace-nowrap',
        }}
        action={
          <Button
            variant="outline"
            size="desk"
            icon="refresh"
            className="mt-4 w-[156px] justify-start"
          >
            Vérifier maintenant
          </Button>
        }
      />
      <DeskTable
        label="Enregistrements DNS"
        className="mt-4 shrink-0"
        columns={DNS_COLUMNS}
        rowKey={(r) => r.name}
        rows={[
          { name: '@', value: SPF, state: 'orange', stateLabel: 'À ajouter' },
          {
            name: 'brevo._domainkey',
            value: DKIM,
            state: 'orange',
            stateLabel: 'À ajouter',
          },
          {
            name: '_dmarc',
            value: 'v=DMARC1; p=none; rua=mailto:dmarc@atelier-lumen.fr',
            state: 'grey',
            stateLabel: 'Facultatif',
          },
        ]}
      />
      <div className="mt-[15px] flex shrink-0 gap-2">
        <Button
          variant="outline"
          size="desk"
          icon="copy"
          className="w-[200px] justify-start"
        >
          Copier les enregistrements
        </Button>
        <Button
          variant="outline"
          size="desk"
          icon="send"
          className="w-[140px] justify-start"
        >
          Envoyer à la DSI
        </Button>
      </div>
    </CompanySettingsDesk>
  );
}

/** The same tab once the domain is verified, for a company without a logo. */
export function IdentiteDomaineVerifieDesktop() {
  return (
    <CompanySettingsDesk
      tab="identity"
      shell={companySettingsShell('Identité et e-mails', COMPANY.ferrand)}
    >
      <DeskSectionTitle className="mt-[19px]" title="Identité" />
      <DeskFormRow label="Nom" className="mt-[22px]">
        <DeskInput label="Nom" defaultValue="Maison Ferrand" />
      </DeskFormRow>
      <DeskFormRow
        label="Logo"
        hint="Sans logo, les initiales sur fond gris"
        className="mt-4 h-[72px] [&>div:first-child]:pt-2"
      >
        <div className="flex h-[72px] w-[360px] items-center gap-3 rounded-desk border border-dashed border-border pl-[11px]">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-desk bg-fill-2 text-[19px] font-bold">
            MF
          </span>
          <p className="-mt-1 text-13 leading-[18px] text-ink-2">
            Déposez un logo ou
            <br />
            <span className="font-semibold text-ink">choisissez un fichier</span>
          </p>
        </div>
      </DeskFormRow>
      <div className="mt-6 h-px shrink-0 bg-separator" />
      <DeskSectionTitle className="mt-[23px]" title="Expéditeur des e-mails" />
      <DeskFormRow label="Nom affiché" className="mt-[22px]">
        <DeskInput label="Nom affiché" defaultValue="Accueil Maison Ferrand" />
      </DeskFormRow>
      <DeskFormRow label="Adresse" className="mt-3">
        <DeskInput label="Adresse" defaultValue="accueil@maison-ferrand.fr" />
      </DeskFormRow>
      <Banner
        tone="green"
        icon="check"
        iconSize={18}
        title="maison-ferrand.fr vérifié le 12 octobre · SPF et DKIM en place"
        className="mt-7 h-12 shrink-0 gap-2.5 rounded-desk py-0 pr-4 pl-4"
        classNames={{ title: 'mt-[15px] text-14' }}
      />
      <DeskTable
        label="Enregistrements DNS"
        className="mt-4 shrink-0"
        columns={DNS_COLUMNS}
        rowKey={(r) => r.name}
        rows={[
          { name: '@', value: SPF, state: 'green', stateLabel: 'Vérifié' },
          {
            name: 'brevo._domainkey',
            value: DKIM,
            state: 'green',
            stateLabel: 'Vérifié',
          },
        ]}
      />
    </CompanySettingsDesk>
  );
}

type RetentionRow = {
  data: string;
  where: string;
  duration: string;
  purge: string;
};

const RETENTION: RetentionRow[] = [
  {
    data: 'Photos d’étiquettes',
    where: 'iPhone de la navette',
    duration: '90 jours',
    purge: '14 photos',
  },
  { data: 'Colis remis', where: 'Serveur', duration: '12 mois', purge: '38 colis' },
  {
    data: 'Signatures et photos de remise',
    where: 'Serveur',
    duration: '12 mois',
    purge: '21 preuves',
  },
  {
    data: 'Historique des e-mails',
    where: 'Serveur',
    duration: '6 mois',
    purge: '402 e-mails',
  },
  { data: 'Journal des actions', where: 'Serveur', duration: '24 mois', purge: '—' },
];

const RETENTION_COLUMNS: DeskTableColumn<RetentionRow>[] = [
  {
    key: 'data',
    header: 'Donnée',
    width: 260,
    cell: (r) => <span className="font-semibold">{r.data}</span>,
  },
  {
    key: 'where',
    header: 'Où',
    width: 200,
    cell: (r) => <span className="text-ink-2">{r.where}</span>,
  },
  { key: 'duration', header: 'Durée', width: 160, cell: (r) => r.duration },
  {
    key: 'purge',
    header: 'Prochaine purge',
    cell: (r) => <span className="text-muted">{r.purge}</span>,
  },
];

const PURGE = [
  ['Colis', '38'],
  ['Preuves', '21'],
  ['E-mails', '402'],
] as const;

/** How long the company keeps each kind of data, and what the next night erases. */
export function ConservationDesktop() {
  return (
    <CompanySettingsDesk tab="retention" shell={companySettingsShell('Conservation')}>
      <DeskSectionTitle
        className="mt-[19px]"
        title="Durées de conservation"
        description="Au-delà, les données sont effacées chaque nuit. À valider avec votre DPO."
      />
      <div className="mt-[18px] flex items-start gap-4">
        <div className="flex w-[780px] shrink-0 flex-col gap-[7px]">
          <DeskTable
            label="Durées de conservation"
            columns={RETENTION_COLUMNS}
            rows={RETENTION}
            rowKey={(r) => r.data}
          />
          <DeskPanel overlayStroke title="Modifier « Colis remis »" className="h-[140px]">
            <div className="mt-[15px] flex items-start px-4">
              <p className="relative -top-px w-[280px] pt-[7px] text-13 font-semibold">
                Durée
              </p>
              <button
                type="button"
                className="flex h-8 w-[200px] cursor-pointer items-center justify-between rounded-[6px] px-2.5 text-13 outline-none shadow-[0_0_0_0.5px_var(--color-border),inset_0_0_0_0.5px_var(--color-border)] focus-visible:ring-2 focus-visible:ring-blue"
              >
                <span className="-mt-[3px]">12 mois</span>
                <Icon name="chevron" size={12} className="rotate-90" />
              </button>
            </div>
            <p className="mt-3 px-4 text-12 text-orange-strong">
              Réduire la durée efface tout de suite les colis plus anciens : 112
              colis cette nuit.
            </p>
          </DeskPanel>
        </div>
        <DeskPanel overlayStroke
          title="Prochaine purge"
          subtitle="Cette nuit à 3:00"
          className="h-[210px] w-[356px]"
        >
          <dl className="mt-[15px] flex flex-col gap-3.5 px-4">
            {PURGE.map(([label, value]) => (
              <div key={label} className="flex h-4 text-13">
                <dt className="relative -top-px w-[120px] text-muted">{label}</dt>
                <dd className="relative -top-px font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 px-4">
            <Button
              variant="outline"
              size="desk"
              icon="download"
              block
              className="justify-start"
            >
              Exporter avant la purge
            </Button>
          </div>
        </DeskPanel>
      </div>
    </CompanySettingsDesk>
  );
}

/** The company's settings on the phone. */
export function EntrepriseMobile() {
  return (
    <PhoneSettings title="Entreprise">
      <PhoneGroup className="mt-4">
        <div className="relative h-[72px]">
          <Avatar
            initials="AL"
            size="md"
            tone="fill"
            className="absolute top-[18px] left-3.5 size-9 rounded-full bg-fill-2 text-13"
          />
          <p className="absolute top-3 left-[62px] text-16 font-semibold">
            Atelier Lumen
          </p>
          <p className="absolute top-[34px] left-[62px] text-13 text-muted">
            Nom et logo
          </p>
          <Icon
            name="chevron"
            size={16}
            strokeWidth={2.2}
            className="absolute top-7 right-3.5 text-faint"
          />
        </div>
      </PhoneGroup>
      <PhoneGroupTitle className="mt-[22px]">E-mails</PhoneGroupTitle>
      <PhoneGroup className="mt-1.5">
        <PhoneSettingRow
          icon={{ name: 'send', tone: 'ink' }}
          title="Expéditeur"
          value="courrier@…"
          separator
          raised
        />
        <PhoneSettingRow
          icon={{ name: 'globe', tone: 'orange' }}
          title="Domaine"
          value={
            <StatusPill
              tone="orange"
              size="sm"
              icon="alert"
              label="À vérifier"
              className="-mt-[3px] h-6"
            />
          }
        />
      </PhoneGroup>
      <PhoneGroupTitle className="mt-[22px]">Fonctionnement</PhoneGroupTitle>
      <PhoneGroup className="mt-1.5">
        <PhoneSettingRow
          icon={{ name: 'sliders', tone: 'ink' }}
          title="Étapes"
          value="Multi-départ."
          separator
        />
        <PhoneSettingRow
          icon={{ name: 'building', tone: 'grey' }}
          title="Départements"
          value="4"
        />
      </PhoneGroup>
      <PhoneGroupTitle className="mt-[22px]">Données</PhoneGroupTitle>
      <PhoneGroup className="mt-1.5">
        <PhoneSettingRow
          icon={{ name: 'shield', tone: 'green' }}
          title="Conservation"
          value="12 mois"
          raised
        />
      </PhoneGroup>
    </PhoneSettings>
  );
}

function DnsRecordCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <PhoneGroup className={cn('relative h-[84px]', className)}>
      <p className="absolute top-3.5 left-4 -mt-px text-13 font-semibold text-muted">
        {label}
      </p>
      <p className="absolute top-10 left-4 font-mono text-14 whitespace-pre">
        {value}
      </p>
      <button
        type="button"
        aria-label={`Copier ${label}`}
        className="absolute top-5 right-3 flex size-11 cursor-pointer items-center justify-center rounded-full bg-fill outline-none focus-visible:ring-2 focus-visible:ring-blue"
      >
        <Icon name="copy" size={22} />
      </button>
    </PhoneGroup>
  );
}

const DOMAIN_BANNER = {
  className: 'mt-4 h-[83px] shrink-0 items-start gap-2.5 rounded-[14px] py-0 pr-4 pl-4',
  classNames: {
    icon: 'mt-4',
    title: 'mt-[15px] text-15',
    description: 'mt-0.5 text-13 leading-4',
  },
} as const;

function DomainBottomBar({ label }: { label: string }) {
  return (
    <BottomBar surface="line" className="pt-[23px] pb-9">
      <Button block icon="refresh" iconSize={20} className="gap-2">
        {label}
      </Button>
    </BottomBar>
  );
}

/** The two DNS records to hand to the host, on the phone. */
export function DomaineMobile() {
  return (
    <PhoneSettings
      title="Domaine"
      bottom={<DomainBottomBar label="Vérifier maintenant" />}
    >
      <Banner
        tone="orange"
        icon="alert"
        title="atelier-lumen.fr pas encore vérifié"
        description="En attendant, les e-mails partent de notifications@courrier.app."
        {...DOMAIN_BANNER}
      />
      <PhoneGroupTitle className="mt-[23px]">
        À ajouter chez votre hébergeur DNS
      </PhoneGroupTitle>
      <DnsRecordCard
        className="mt-2"
        label="SPF · TXT sur @"
        value={SPF}
      />
      <DnsRecordCard
        className="mt-3"
        label="DKIM · TXT sur brevo._domainkey"
        value="k=rsa; p=MIGfMA0GCSqGSIb3…"
      />
    </PhoneSettings>
  );
}

/** What the check found when it failed, on the phone. */
export function DomaineVerificationEchoueeMobile() {
  return (
    <PhoneSettings title="Domaine" bottom={<DomainBottomBar label="Réessayer" />}>
      <Banner
        tone="red"
        icon="alert"
        title="DKIM introuvable"
        description="SPF est en place, pas DKIM. La propagation peut prendre jusqu’à 48 h : réessayez plus tard."
        {...DOMAIN_BANNER}
      />
      <PhoneGroup className="mt-[37px]">
        <PhoneSettingRow
          title="SPF"
          chevron={false}
          separator
          value={
            <StatusPill
              tone="green"
              size="sm"
              icon="check"
              label="Trouvé"
              className="-mt-[3px] h-6"
            />
          }
        />
        <PhoneSettingRow
          title="DKIM"
          chevron={false}
          value={
            <StatusPill
              tone="red"
              size="sm"
              icon="x"
              label="Introuvable"
              className="-mt-[3px] h-6"
            />
          }
        />
      </PhoneGroup>
    </PhoneSettings>
  );
}

/** The retention periods and the next purge, on the phone. */
export function ConservationMobile() {
  return (
    <PhoneSettings title="Conservation">
      <PhoneGroup className="mt-4">
        <PhoneSettingRow title="Photos d’étiquettes" value="90 jours" separator />
        <PhoneSettingRow title="Colis remis" value="12 mois" separator />
        <PhoneSettingRow title="Signatures et photos" value="12 mois" separator />
        <PhoneSettingRow title="Historique des e-mails" value="6 mois" raised />
      </PhoneGroup>
      <p className="relative -top-px mt-2 px-4 text-13 leading-4 text-muted">
        Les photos d’étiquettes restent sur l’iPhone de la navette (D8).
      </p>
      <PhoneGroup className="relative mt-4 h-[116px]">
        <span className="absolute top-[18px] left-3.5 flex size-7 items-center justify-center rounded-[7px] bg-muted text-white">
          <Icon name="trash" size={16} strokeWidth={2.2} />
        </span>
        <p className="absolute top-3 left-14 text-16 font-semibold">
          Prochaine purge
        </p>
        <p className="absolute top-[34px] left-14 text-13 text-muted">
          Cette nuit · 38 colis, 21 preuves
        </p>
        <span className="absolute top-[63px] right-0 left-14 h-px bg-separator" />
        <p className="absolute top-[81px] left-4 text-16">
          Exporter avant la purge
        </p>
      </PhoneGroup>
    </PhoneSettings>
  );
}

