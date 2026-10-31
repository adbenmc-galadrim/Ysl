import type { ReactNode } from 'react';

import { Button } from '#components/button';
import { CompanyLogo } from '#components/company-parts';
import { CompanyShell } from '#components/company-shell';
import { DeskPanel, DeskStats, type DeskStat } from '#components/desk-panel';
import { DeskTable, type DeskTableColumn } from '#components/desk-table';
import { StatusDot } from '#components/status-dot';
import { ACCOUNT, COMPANY, crumbs, PLATFORM_NAV } from '#fixtures/multi-entreprises';
import { Icon } from '#icons';
import { cn } from '#lib/tv';
import type { PlatformChrome } from '#screens/multi-entreprises/03-accueil/entreprises-screen';

type Admin = {
  name: string;
  email: string;
  tone: 'green' | 'blue';
  invitation: string;
};

const ADMINS: Admin[] = [
  {
    name: 'Claire Bonnet',
    email: 'claire.bonnet@atelier-lumen.fr',
    tone: 'green',
    invitation: 'Acceptée',
  },
  {
    name: 'Marc Ollier',
    email: 'marc.ollier@atelier-lumen.fr',
    tone: 'blue',
    invitation: 'Envoyée il y a 2 j',
  },
];

const ADMIN_COLUMNS: DeskTableColumn<Admin>[] = [
  {
    key: 'name',
    header: 'Nom',
    width: 150,
    cell: (a) => <span className="font-semibold">{a.name}</span>,
  },
  {
    key: 'email',
    header: 'E-mail',
    width: 230,
    cell: (a) => <span className="text-ink-2">{a.email}</span>,
  },
  {
    key: 'invitation',
    header: 'Invitation',
    cell: (a) => <StatusDot size="sm" tone={a.tone} label={a.invitation} />,
  },
];

const MONTHS = [
  { label: 'mai', height: 67.6 },
  { label: 'juin', height: 91.59 },
  { label: 'juil.', height: 99.22 },
  { label: 'août', height: 113.4 },
  { label: 'sept.', height: 124.95 },
  { label: 'oct.', height: 140 },
];

const PROFILE = [
  ['Modèle de départ', 'Multi-départements'],
  ['Étapes modifiées', '2'],
  ['Dernière modification', '21 oct., Claire Bonnet'],
];

const JOURNAL = [
  ['21 oct., 14:02', 'Invitation renvoyée à Marc Ollier'],
  ['3 sept., 10:15', 'Entreprise créée, modèle Multi-départements'],
];

/** A real company on the record; without it, the mockup's. No account name in it (D26). */
export type CompanySheetData = {
  name: string;
  initials: string;
  /** « Active · créée le … · modèle … ». */
  status: string;
  suspended: boolean;
  stats: DeskStat[];
  profile: string[][];
  actions: ReactNode;
  /** Its last lines, the platform account's acts and no one else's (D26). */
  journal: {
    title: string;
    allLabel: string;
    onAll?: () => void;
    lines: { id: string; when: string; what: string }[];
  };
};

function ProfilePanel({
  rows,
  subtitle = 'Choisi à la création, géré ensuite par l’entreprise. Lecture seule.',
}: {
  rows: string[][];
  subtitle?: string;
}) {
  return (
    <DeskPanel
      title="Profil de fonctionnement"
      subtitle={subtitle}
      className="h-[180px]"
    >
      <dl className="mt-4 flex flex-col gap-3.5 px-[15px] text-13">
        {rows.map(([label, value]) => (
          <div key={label} className="flex">
            <dt className="w-[180px] text-muted">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </DeskPanel>
  );
}

function CompanySheet({
  overlay,
  chrome,
  data,
}: {
  overlay?: ReactNode;
  chrome?: PlatformChrome;
  data?: CompanySheetData;
}) {
  return (
    <CompanyShell
      company={COMPANY.platform}
      nav={PLATFORM_NAV}
      active="entreprises"
      account={ACCOUNT.platform}
      breadcrumb={crumbs('Plateforme', 'Entreprises', data?.name ?? 'Atelier Lumen')}
      overlay={overlay}
      {...chrome}
    >
      <header className="-mt-1.5 flex h-[70px] shrink-0 items-start">
        <CompanyLogo
          initials={data?.initials ?? 'AL'}
          size="desk-40"
          muted={data?.suspended}
          className="mt-0.5"
        />
        <div className="ml-3 min-w-0 flex-1">
          <h1 className="text-22 font-bold tracking-[-0.3px]">
            {data?.name ?? 'Atelier Lumen'}
          </h1>
          <p className="relative mt-[3px] flex items-center gap-1.5 text-13 text-muted">
            <span
              className={cn(
                'mt-[3px] size-2 rounded-full',
                data?.suspended ? 'bg-orange' : 'bg-green',
              )}
            />
            {data?.status ??
              'Active · créée le 3 septembre 2026 · modèle Multi-départements'}
          </p>
        </div>
        <div className="mt-1.5 flex gap-2">
          {data?.actions ?? (
            <>
              <Button
                variant="outline"
                size="desk"
                icon="pause"
                className="w-[110px] justify-start"
              >
                Suspendre
              </Button>
              <Button variant="outline" size="desk" className="w-11 px-0" aria-label="Plus d’actions">
                <Icon name="more" size={16} className="mt-[3.5px]" />
              </Button>
            </>
          )}
        </div>
      </header>
      <DeskStats
        stats={data?.stats ?? [
          { label: 'Comptes', value: '42' },
          { label: 'Départements', value: '4' },
          { label: 'Colis en octobre', value: '1 284' },
          { label: 'Dernière activité', value: '5 min' },
        ]}
      />
      {data ? (
        <div className="mt-5 flex shrink-0 gap-4">
          <div className="flex w-[568px] shrink-0 flex-col gap-4">
            <ProfilePanel rows={data.profile} />
          </div>
          <div className="flex w-[568px] shrink-0 flex-col gap-4">
            <DeskPanel
              title={data.journal.title}
              action={
                <button
                  type="button"
                  className="cursor-pointer"
                  onClick={data.journal.onAll}
                >
                  {data.journal.allLabel}
                </button>
              }
              className="h-[180px]"
            >
              <div className="mt-3.5 flex flex-col gap-[18px] px-[15px] text-13">
                {data.journal.lines.map((line) => (
                  <p key={line.id} className="flex">
                    <span className="w-[124px] shrink-0 text-muted">
                      {line.when}
                    </span>
                    {line.what}
                  </p>
                ))}
              </div>
            </DeskPanel>
          </div>
        </div>
      ) : (
      <div className="mt-5 flex shrink-0 gap-4">
        <div className="flex w-[568px] shrink-0 flex-col gap-4">
          <DeskPanel title="Administrateurs" action="Inviter" className="h-[220px]">
            <DeskTable
              label="Administrateurs"
              className="mx-[15px] mt-[11px] shrink-0"
              columns={ADMIN_COLUMNS}
              rows={ADMINS}
              rowKey={(a) => a.email}
            />
          </DeskPanel>
          <ProfilePanel
            rows={PROFILE}
            subtitle="Choisi à la création, géré ensuite par l’entreprise (D30). Lecture seule."
          />
        </div>
        <div className="flex w-[568px] shrink-0 flex-col gap-4">
          <DeskPanel
            title="Colis par mois"
            subtitle="Total, tous départements"
            className="h-[260px]"
          >
            <div className="mt-[17px] flex h-[140px] items-end gap-6 px-[15px]">
              {MONTHS.map((month, i) => (
                <span
                  key={month.label}
                  className={
                    i === MONTHS.length - 1
                      ? 'flex-1 rounded-[4px] bg-ink'
                      : 'flex-1 rounded-[4px] bg-faint'
                  }
                  style={{ height: month.height }}
                />
              ))}
            </div>
            <div className="mt-2 flex gap-6 px-[15px]">
              {MONTHS.map((month) => (
                <span
                  key={month.label}
                  className="flex-1 text-center text-12 text-muted"
                >
                  {month.label}
                </span>
              ))}
            </div>
          </DeskPanel>
          <DeskPanel title="Journal" action="Tout voir" className="h-[140px]">
            <div className="mt-3.5 flex flex-col gap-[18px] px-[15px] text-13">
              {JOURNAL.map(([when, what]) => (
                <p key={when} className="flex">
                  <span className="w-[124px] text-muted">{when}</span>
                  {what}
                </p>
              ))}
            </div>
          </DeskPanel>
        </div>
      </div>
      )}
    </CompanyShell>
  );
}

/** A client seen by the platform: figures, its admins, nothing of its content. */
export function FicheEntrepriseDesktop({
  chrome,
  data,
  overlay,
}: {
  chrome?: PlatformChrome;
  data?: CompanySheetData;
  overlay?: ReactNode;
} = {}) {
  return <CompanySheet chrome={chrome} data={data} overlay={overlay} />;
}

function Dialog({
  top,
  height,
  children,
  footer,
}: {
  top: number;
  height: number;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="absolute inset-0 bg-black/32">
      <div
        role="dialog"
        aria-modal="true"
        className="absolute left-1/2 flex w-[480px] max-w-[calc(100%-32px)] -translate-x-1/2 flex-col rounded-desk bg-surface shadow-[0_16px_48px_rgb(0_0_0/0.2)]"
        style={{ top, height }}
      >
        <div className="min-h-0 flex-1 px-6 pt-[22px]">{children}</div>
        <div className="flex h-[72px] shrink-0 justify-end gap-2 border-t border-separator pt-[17px] pr-6">
          {footer}
        </div>
      </div>
    </div>
  );
}

export type ConfirmDialogProps = {
  name: string;
  /** What will happen, in figures: no account or employee is named (D26). */
  description: string;
  pending?: boolean;
  error?: string;
  onCancel?: () => void;
  onConfirm?: () => void;
};

/**
 * Asks before the company stops working. `reason` is the mockup's alone: free
 * text could name someone, so the app never asks one (D26, YSL-123).
 */
export function SuspendDialog({
  name,
  description,
  reason,
  pending = false,
  error,
  onCancel,
  onConfirm,
}: ConfirmDialogProps & { reason?: string }) {
  return (
    <Dialog
      top={240}
      height={reason ? 330 : 240}
      footer={
        <>
          <Button
            variant="outline"
            size="desk"
            className="w-[84px]"
            onClick={onCancel}
          >
            Annuler
          </Button>
          <Button
            size="desk"
            className="w-[110px]"
            disabled={pending}
            onClick={onConfirm}
          >
            Suspendre
          </Button>
        </>
      }
    >
      <h2 className="text-[18px] leading-[22px] font-bold">
        Suspendre {name} ?
      </h2>
      <p className="mt-2 text-13 leading-[18px] text-ink-2">{description}</p>
      {reason && (
        <>
          <p className="mt-[37px] text-13 font-semibold">
            Raison (pour le journal)
          </p>
          <div className="mt-[7px] h-8 rounded-[6px] pt-1.5 pl-2.5 text-13 shadow-[inset_0_0_0_1px_var(--color-border)]">
            {reason}
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-13 text-red">
          {error}
        </p>
      )}
    </Dialog>
  );
}

/** Deleting for good: the button wakes only once the name is typed. */
export function DeleteDialog({
  name,
  description,
  typed,
  onTyped,
  exportHint = 'Son administrateur exporte colis et preuves depuis Rapports.',
  pending = false,
  error,
  onCancel,
  onConfirm,
}: ConfirmDialogProps & {
  /** Where the company's admin finds the export today. */
  exportHint?: string;
  typed: string;
  onTyped?: (value: string) => void;
}) {
  return (
    <Dialog
      top={200}
      height={420}
      footer={
        <>
          <Button
            variant="outline"
            size="desk"
            className="w-[84px]"
            onClick={onCancel}
          >
            Annuler
          </Button>
          <Button
            variant="outline"
            size="desk"
            disabled={typed.trim() !== name || pending}
            className="w-[190px] text-red disabled:opacity-50"
            onClick={onConfirm}
          >
            Supprimer définitivement
          </Button>
        </>
      }
    >
      <h2 className="text-[18px] leading-[22px] font-bold text-red">
        Supprimer {name} ?
      </h2>
      <p className="mt-2 text-13 leading-[18px] text-ink-2">{description}</p>
      <div className="mt-6 flex h-14 items-start rounded-[6px] bg-fill pl-3">
        <Icon name="download" size={16} className="mt-[19px]" />
        <div className="mt-[9px] ml-2.5">
          <p className="text-13 font-semibold">
            Proposez d’abord l’export à l’entreprise
          </p>
          <p className="mt-[3px] text-12 text-muted">{exportHint}</p>
        </div>
      </div>
      <label className="block">
        <span className="mt-[23px] block text-13 font-semibold">
          Tapez « {name} » pour confirmer
        </span>
        {onTyped ? (
          <input
            value={typed}
            onChange={(event) => onTyped(event.target.value)}
            autoComplete="off"
            className="mt-[7px] h-8 w-full rounded-[6px] pl-2.5 text-13 shadow-[inset_0_0_0_1px_var(--color-ink-2)] outline-none"
          />
        ) : (
          <div className="mt-[7px] h-8 rounded-[6px] pt-1.5 pl-2.5 text-13 shadow-[inset_0_0_0_1px_var(--color-ink-2)]">
            {typed}
          </div>
        )}
      </label>
      {error && (
        <p role="alert" className="mt-2 text-13 text-red">
          {error}
        </p>
      )}
    </Dialog>
  );
}

/** No mock-up: the delete dialog's bones, for a typo in a client's name. */
export function RenameDialog({
  name,
  onName,
  disabled = false,
  error,
  onCancel,
  onConfirm,
}: {
  name: string;
  onName: (value: string) => void;
  disabled?: boolean;
  error?: string;
  onCancel?: () => void;
  onConfirm?: () => void;
}) {
  return (
    <Dialog
      top={240}
      height={230}
      footer={
        <>
          <Button
            variant="outline"
            size="desk"
            className="w-[84px]"
            onClick={onCancel}
          >
            Annuler
          </Button>
          <Button
            size="desk"
            className="w-[110px]"
            disabled={disabled}
            onClick={onConfirm}
          >
            Renommer
          </Button>
        </>
      }
    >
      <h2 className="text-[18px] leading-[22px] font-bold">
        Renommer l’entreprise
      </h2>
      <label className="block">
        <span className="mt-4 block text-13 font-semibold">
          Nom de l’entreprise
        </span>
        <input
          value={name}
          onChange={(event) => onName(event.target.value)}
          maxLength={80}
          className="mt-[7px] h-8 w-full rounded-[6px] pl-2.5 text-13 shadow-[inset_0_0_0_1px_var(--color-ink-2)] outline-none"
        />
      </label>
      {error && (
        <p role="alert" className="mt-2 text-13 text-red">
          {error}
        </p>
      )}
    </Dialog>
  );
}

/** The record under the question of suspending the company. */
export function SuspendreDesktop() {
  return (
    <CompanySheet
      overlay={
        <SuspendDialog
          name="Atelier Lumen"
          description="Les 42 comptes ne pourront plus se connecter ni synchroniser. Colis, annuaire et réglages sont gardés ; vous pourrez réactiver."
          reason="Fin de contrat au 31 octobre"
        />
      }
    />
  );
}

/** The record under the question of deleting the company for good. */
export function SupprimerDesktop() {
  return (
    <CompanySheet
      overlay={
        <DeleteDialog
          name="Atelier Lumen"
          description="Tout sera effacé sans retour : 42 comptes, 4 départements, l’annuaire et 3 812 colis avec leurs preuves."
          typed="Atelier Lum"
        />
      }
    />
  );
}
