import type { ReactNode } from 'react';

import { Button } from '#components/button';
import { CompanyShell } from '#components/company-shell';
import { DeskTable, type DeskTableColumn } from '#components/desk-table';
import { StatusDot } from '#components/status-dot';
import {
  ACCOUNT,
  COMPANY,
  crumbs,
  PLATFORM_NAV,
} from '#fixtures/multi-entreprises';
import { Icon } from '#icons';
import {
  CompanyLogo,
  DeskPanel,
  DeskStats,
} from '#screens/multi-entreprises/03-accueil/company-parts';

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

function Fiche({ overlay }: { overlay?: ReactNode }) {
  return (
    <CompanyShell
      company={COMPANY.platform}
      nav={PLATFORM_NAV}
      active="entreprises"
      account={ACCOUNT.platform}
      breadcrumb={crumbs('Plateforme', 'Entreprises', 'Atelier Lumen')}
      overlay={overlay}
    >
      <header className="-mt-1.5 flex h-[70px] shrink-0 items-start">
        <CompanyLogo initials="AL" size="desk-40" className="mt-0.5" />
        <div className="ml-3 min-w-0 flex-1">
          <h1 className="text-22 font-bold tracking-[-0.3px]">Atelier Lumen</h1>
          <p className="relative mt-[3px] flex items-center gap-1.5 text-13 text-muted">
            <span className="mt-[3px] size-2 rounded-full bg-green" />
            Active · créée le 3 septembre 2026 · modèle Multi-départements
          </p>
        </div>
        <div className="mt-1.5 flex gap-2">
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
        </div>
      </header>
      <DeskStats
        stats={[
          { label: 'Comptes', value: '42' },
          { label: 'Départements', value: '4' },
          { label: 'Colis en octobre', value: '1 284' },
          { label: 'Dernière activité', value: '5 min' },
        ]}
      />
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
          <DeskPanel
            title="Profil de fonctionnement"
            subtitle="Choisi à la création, géré ensuite par l’entreprise (D30). Lecture seule."
            className="h-[180px]"
          >
            <dl className="mt-4 flex flex-col gap-3.5 px-[15px] text-13">
              {PROFILE.map(([label, value]) => (
                <div key={label} className="flex">
                  <dt className="w-[180px] text-muted">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </DeskPanel>
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
    </CompanyShell>
  );
}

/** A client seen by the platform: figures, its admins, nothing of its content. */
export function FicheEntrepriseDesktop() {
  return <Fiche />;
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
        className="absolute left-[480px] flex w-[480px] flex-col rounded-desk bg-surface shadow-[0_16px_48px_rgb(0_0_0/0.2)]"
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

/** The record under the question of suspending the company. */
export function SuspendreDesktop() {
  return (
    <Fiche
      overlay={
        <Dialog
          top={240}
          height={330}
          footer={
            <>
              <Button variant="outline" size="desk" className="w-[84px]">
                Annuler
              </Button>
              <Button size="desk" className="w-[110px]">
                Suspendre
              </Button>
            </>
          }
        >
          <h2 className="text-[18px] leading-[22px] font-bold">
            Suspendre Atelier Lumen ?
          </h2>
          <p className="mt-2 text-13 leading-[18px] text-ink-2">
            Les 42 comptes ne pourront plus se connecter ni synchroniser. Colis,
            annuaire et réglages sont gardés ; vous pourrez réactiver.
          </p>
          <p className="mt-[37px] text-13 font-semibold">
            Raison (pour le journal)
          </p>
          <div className="mt-[7px] h-8 rounded-[6px] pt-1.5 pl-2.5 text-13 shadow-[inset_0_0_0_1px_var(--color-border)]">
            Fin de contrat au 31 octobre
          </div>
        </Dialog>
      }
    />
  );
}

/** The record under the question of deleting the company for good. */
export function SupprimerDesktop() {
  return (
    <Fiche
      overlay={
        <Dialog
          top={200}
          height={420}
          footer={
            <>
              <Button variant="outline" size="desk" className="w-[84px]">
                Annuler
              </Button>
              <Button
                variant="outline"
                size="desk"
                disabled
                className="w-[190px] text-red disabled:opacity-50"
              >
                Supprimer définitivement
              </Button>
            </>
          }
        >
          <h2 className="text-[18px] leading-[22px] font-bold text-red">
            Supprimer Atelier Lumen ?
          </h2>
          <p className="mt-2 text-13 leading-[18px] text-ink-2">
            Tout sera effacé sans retour : 42 comptes, 4 départements, l’annuaire
            et 3 812 colis avec leurs preuves.
          </p>
          <div className="mt-6 flex h-14 items-start rounded-[6px] bg-fill pl-3">
            <Icon name="download" size={16} className="mt-[19px]" />
            <div className="mt-[9px] ml-2.5">
              <p className="text-13 font-semibold">
                Proposez d’abord l’export à l’entreprise
              </p>
              <p className="mt-[3px] text-12 text-muted">
                Son administrateur exporte colis et preuves depuis Rapports.
              </p>
            </div>
          </div>
          <p className="mt-[23px] text-13 font-semibold">
            Tapez « Atelier Lumen » pour confirmer
          </p>
          <div className="mt-[7px] h-8 rounded-[6px] pt-1.5 pl-2.5 text-13 shadow-[inset_0_0_0_1px_var(--color-ink-2)]">
            Atelier Lum
          </div>
        </Dialog>
      }
    />
  );
}
