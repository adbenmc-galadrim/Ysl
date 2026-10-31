import type { ReactNode } from 'react';

import { Button } from '#components/button';
import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import { DeskTable, type DeskTableColumn } from '#components/desk-table';
import { IconButton } from '#components/icon-button';
import { NavBar } from '#components/nav-bar';
import {
  KraftThumb,
  PhoneBanner,
  PhoneRow,
  RoundTile,
  TickMark,
} from '#components/phone-parts';
import { ProgressBar } from '#components/progress-bar';
import { Screen } from '#components/screen';
import { StatusDot } from '#components/status-dot';
import { ACCOUNT, COMPANY, crumbs, DEPARTMENT_NAV } from '#fixtures/multi-entreprises';
import { Icon } from '#icons';
import { cn } from '#lib/tv';
import {
  DepositBottom,
  DepositCounter,
  DepositGroup,
} from '#screens/multi-entreprises/09-depot-au-departement/deposit-parts';

const CLOSE = <IconButton icon="x" label="Fermer" size="lg" iconSize={22} />;
const CLOSE_BAR = '[&>div:first-child]:pl-0';

/** The count of a deposit on the phone, when it matches what was announced. */
export function DepartementConfirmerMobile() {
  return (
    <Screen
      bottom={
        <DepositBottom>
          <Button>Confirmer 6 colis</Button>
          <Button variant="secondary">Le compte n’y est pas</Button>
        </DepositBottom>
      }
    >
      <NavBar leading={CLOSE} title="Dépôt de Karim" className={CLOSE_BAR} />
      <p className="mt-4 text-center text-15 text-muted">
        Posé à 10:56 · 6 colis annoncés
      </p>
      <DepositCounter value={6} className="mt-[46px]" />
      <p className="mt-2 text-center text-17 font-semibold">colis comptés</p>
      <DepositGroup
        className="mt-9"
        items={[
          { icon: 'list', title: 'Voir les 6 colis', chevron: true },
          {
            icon: 'pin',
            iconColor: 'red',
            title: 'Rangés où ?',
            value: 'Étagère A',
            chevron: true,
          },
        ]}
      />
    </Screen>
  );
}

const SEGMENTS = ['Manquant', 'En trop', 'Salarié parti'];

/** The same count, one short: why, and which parcel. */
export function DepartementConfirmerEcartMobile() {
  return (
    <Screen
      bottom={
        <DepositBottom>
          <Button>Confirmer 5 et signaler</Button>
        </DepositBottom>
      }
    >
      <NavBar leading={CLOSE} title="Dépôt de Karim" className={CLOSE_BAR} />
      <p className="mt-4 text-center text-15 text-muted">
        Posé à 10:56 · 6 colis annoncés
      </p>
      <DepositCounter value={5} alert className="mt-[46px]" />
      <PhoneBanner
        tone="red"
        icon="warning"
        className="mt-3.5"
        title="Il manque 1 colis"
        description="Désignez-le si vous savez lequel."
        height={67}
      />
      <div
        role="radiogroup"
        aria-label="Nature de l’écart"
        className="mt-[23px] grid h-11 grid-cols-3 rounded-full bg-fill-2 p-0.5"
      >
        {SEGMENTS.map((segment, i) => (
          <button
            key={segment}
            type="button"
            role="radio"
            aria-checked={i === 0}
            className={cn(
              'cursor-pointer rounded-[20px] text-14 font-semibold',
              i === 0 ? 'bg-ink text-on-ink' : 'text-ink-2',
            )}
          >
            {segment}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <PhoneRow
          leading={<KraftThumb />}
          title="Inès Garnier"
          lines={['FedEx ···3338']}
          mark={<TickMark />}
          separator
        />
        <PhoneRow
          leading={<RoundTile icon="info" />}
          title="Je ne sais pas"
          lines={['Les 6 colis passent à régulariser']}
          mark={<TickMark checked={false} chevron />}
        />
      </div>
    </Screen>
  );
}

const SCANNED = ['Camille Morel', 'Hugo Lefèvre', 'Samuel Petit (1/2)', 'Samuel Petit (2/2)'];
const TO_SCAN = ['Inès Garnier', 'Axelle Bernard'];

/** The count made by scanning each parcel of the deposit. */
export function DepartementColisParColisMobile() {
  return (
    <Screen
      bottom={
        <DepositBottom>
          <Button icon="scan" iconSize={20} className="gap-2">
            Scanner le suivant
          </Button>
          <Button variant="secondary">Terminer à 4 colis</Button>
        </DepositBottom>
      }
    >
      <NavBar leading={CLOSE} title="Dépôt de Karim" className={CLOSE_BAR} />
      <h1 className="mt-4 text-22 font-bold">4 colis sur 6 scannés</h1>
      <ProgressBar
        value={4 / 6}
        label="Colis scannés"
        className="mt-2.5 bg-fill-2"
      />
      <div className="mt-[18px]">
        {SCANNED.map((name) => (
          <PhoneRow
            key={name}
            leading={<KraftThumb />}
            title={name}
            lines={['Scanné']}
            mark={<TickMark />}
            height={60}
            separator
          />
        ))}
        {TO_SCAN.map((name) => (
          <PhoneRow
            key={name}
            leading={<KraftThumb />}
            title={name}
            lines={['À scanner']}
            mark={<TickMark checked={false} chevron />}
            height={60}
            separator
          />
        ))}
      </div>
    </Screen>
  );
}

/** Where the deposit is put away. */
export function DepartementEmplacementMobile() {
  return (
    <Screen
      bottom={
        <DepositBottom>
          <Button>Ranger les 6 colis</Button>
        </DepositBottom>
      }
    >
      <NavBar title="Dépôt · 6 colis" />
      <h1 className="mt-3 text-22 font-bold">Où rangez-vous ce lot ?</h1>
      <p className="mt-1.5 text-14 text-muted">
        Choisi au dépôt, plus à la réception du service courrier
      </p>
      <DepositGroup
        tone="surface"
        className="mt-[29px]"
        items={[
          {
            icon: 'pin',
            iconColor: 'ink',
            title: 'Étagère A',
            subtitle: 'Studio · comptoir',
          },
          { icon: 'pin', title: 'Casier 3', subtitle: 'Studio · fermé à clé' },
          {
            icon: 'pin',
            title: 'Armoire volumineux',
            subtitle: 'Studio · sous-sol',
          },
        ]}
      />
      <Button
        variant="secondary"
        size="md"
        icon="plusSquare"
        iconSize={20}
        className="mt-[18px] h-12 bg-transparent"
      >
        Ajouter un emplacement
      </Button>
    </Screen>
  );
}

/** The deposit is counted: what the department needs to know next. */
export function DepartementDepotConfirmeMobile() {
  return (
    <Screen
      bottom={
        <DepositBottom>
          <Button>Terminé</Button>
        </DepositBottom>
      }
    >
      <span className="mx-auto mt-[102px] flex size-[88px] items-center justify-center rounded-full bg-green-solid text-white">
        <Icon name="tick" size={44} />
      </span>
      <h1 className="mt-6 text-center text-28 font-bold">6 colis présents</h1>
      <p className="mt-1.5 text-center text-15 text-muted">
        Rangés étagère A · 10:58
      </p>
      <DepositGroup
        className="mt-10"
        items={[
          {
            icon: 'mail',
            iconColor: 'ink',
            title: 'Salariés prévenus',
            value: '5',
          },
          { icon: 'truck', title: 'Karim est informé', value: 'Oui' },
        ]}
      />
    </Screen>
  );
}

type Deposit = {
  id: string;
  at: string;
  by: string;
  count: number;
  state: string;
  tone: 'orange' | 'green';
};

const DEPOSITS: Deposit[] = [
  {
    id: 'karim',
    at: 'Aujourd’hui, 10:56',
    by: 'Karim Daoud',
    count: 6,
    state: 'À confirmer',
    tone: 'orange',
  },
  {
    id: 'sophie',
    at: 'Aujourd’hui, 8:40',
    by: 'Sophie Lambert',
    count: 4,
    state: 'Confirmé par Julie Perrin',
    tone: 'green',
  },
];

const DEPOSIT_COLUMNS: DeskTableColumn<Deposit>[] = [
  {
    key: 'at',
    header: 'Posé',
    width: 160,
    cell: (d) => <span className="font-semibold">{d.at}</span>,
  },
  { key: 'by', header: 'Par', width: 200, cell: (d) => d.by },
  { key: 'count', header: 'Colis', width: 120, cell: (d) => d.count },
  {
    key: 'state',
    header: 'État',
    cell: (d) => <StatusDot size="sm" tone={d.tone} label={d.state} />,
  },
];

function DepositDialog({
  body,
  footer,
}: {
  body: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="absolute inset-0 bg-black/32">
      <div
        role="dialog"
        aria-label="Confirmer le dépôt de Karim"
        className="absolute top-[140px] left-[460px] flex h-[600px] w-[520px] flex-col rounded-desk bg-surface shadow-[0_16px_48px_rgb(0_0_0/0.2)]"
      >
        <header className="relative h-[85px] shrink-0 border-b border-separator pt-[22px] pl-6">
          <h2 className="text-18 font-bold">Confirmer le dépôt de Karim</h2>
          <p className="relative -top-px mt-1.5 text-13 text-muted">
            Posé à 10:56. Comptez les colis reçus.
          </p>
          <Icon name="x" size={16} className="absolute top-6 right-6 text-muted" />
        </header>
        <div className="flex h-[435px] shrink-0 flex-col px-6">
          <p className="relative -top-px mt-[27px] text-center text-13 text-muted">
            Karim annonce 6 colis
          </p>
          {body}
        </div>
        <footer className="flex flex-1 items-start justify-between border-t border-separator px-6 pt-[23px]">
          {footer}
        </footer>
      </div>
    </div>
  );
}

function DepositsPage({ overlay }: { overlay: ReactNode }) {
  return (
    <CompanyShell
      company={COMPANY.studio}
      nav={DEPARTMENT_NAV}
      active="depots"
      account={ACCOUNT.department}
      breadcrumb={crumbs('Studio', 'Dépôts à confirmer')}
      overlay={overlay}
    >
      <DeskPageHeader title="Dépôts à confirmer" subtitle="1 dépôt · Studio" />
      <DeskTable
        label="Dépôts"
        columns={DEPOSIT_COLUMNS}
        rows={DEPOSITS}
        rowKey={(d) => d.id}
      />
    </CompanyShell>
  );
}

/** The deposits on the computer, the count open over them. */
export function DepartementConfirmerDesktop() {
  return (
    <DepositsPage
      overlay={
        <DepositDialog
          body={
            <>
              <DepositCounter value={6} className="mt-3" />
              <p className="mt-1 text-center text-15 font-semibold">
                colis comptés
              </p>
              <p className="relative -top-px mt-[22px] text-center text-13 font-medium">
                Voir les 6 colis annoncés
              </p>
              <div className="mt-[34px] -mr-6 flex items-start justify-between">
                <div className="mt-[7px]">
                  <p className="relative -top-px text-13 font-semibold">Rangés où ?</p>
                  <p className="mt-1 text-12 text-muted">
                    Facultatif, repris dans l’e-mail
                  </p>
                </div>
                <span className="flex h-8 w-[216px] items-center justify-between rounded-[6px] border border-border pr-2 pl-[9px] text-13">
                  <span className="-mt-[3.5px]">Étagère A</span>
                  <Icon name="chevron" size={12} className="rotate-90 text-muted" />
                </span>
              </div>
            </>
          }
          footer={
            <>
              <Button variant="outline" size="desk" className="w-[170px]">
                Le compte n’y est pas
              </Button>
              <Button size="desk" className="w-40">
                Confirmer 6 colis
              </Button>
            </>
          }
        />
      }
    />
  );
}

type Expected = { id: string; name: string; tracking: string };

const EXPECTED: Expected[] = [
  { id: 'camille', name: 'Camille Morel', tracking: 'UPS ···0622' },
  { id: 'ines', name: 'Inès Garnier', tracking: 'FedEx ···3338' },
  { id: 'hugo', name: 'Hugo Lefèvre', tracking: 'DHL ···7112' },
];

const EXPECTED_COLUMNS: DeskTableColumn<Expected>[] = [
  {
    key: 'name',
    header: 'Destinataire',
    width: 200,
    cell: (e) => <span className="font-semibold">{e.name}</span>,
  },
  {
    key: 'tracking',
    header: 'Suivi',
    cell: (e) => <span className="text-ink-2">{e.tracking}</span>,
  },
];

/** The same count, one short, with the parcels to point at. */
export function DepartementConfirmerEcartDesktop() {
  return (
    <DepositsPage
      overlay={
        <DepositDialog
          body={
            <>
              <DepositCounter value={5} alert className="mt-3" />
              <div className="mt-2 flex h-10 items-start gap-2.5 rounded-[6px] bg-red-soft pt-[11px] pl-3 text-red">
                <Icon name="warning" size={16} className="mt-px" />
                <span className="relative -top-px text-13 font-semibold">Il manque 1 colis</span>
              </div>
              <p className="relative -top-px mt-4 text-13 font-semibold">Lequel ? (facultatif)</p>
              <DeskTable
                label="Colis annoncés"
                className="mt-2"
                columns={EXPECTED_COLUMNS}
                rows={EXPECTED}
                rowKey={(e) => e.id}
                rowHeight={36}
                selectable
                selected={['ines']}
              />
              <p className="mt-[21px] text-12 text-muted">
                Sans choix, les 6 colis passent « À régulariser » le temps que
                la navette vérifie.
              </p>
            </>
          }
          footer={
            <>
              <Button variant="outline" size="desk" className="w-[84px]">
                Retour
              </Button>
              <Button size="desk" className="w-[190px]">
                Confirmer 5 et signaler
              </Button>
            </>
          }
        />
      }
    />
  );
}

export type DepositGapKindOption = { id: string; label: string };

export type DepartmentDepositParcel = {
  id: string;
  title: string;
  line: string;
  checked: boolean;
};

export type DepartmentDepositProps = {
  title: string;
  line: string;
  counted: number;
  onCount: (value: number) => void;
  countedLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** Taken away offline: the department's count is written on the server. */
  disabled?: boolean;
  notice?: { title: string; description: string };
  onClose?: () => void;
  gapAction?: { label: string; onClick: () => void };
  /** The gap open: its kind and the parcels it concerns. */
  gap?: {
    banner: { title: string; description: string };
    kinds: readonly DepositGapKindOption[];
    kind: string;
    onKind: (id: string) => void;
    parcels: readonly DepartmentDepositParcel[];
    onParcel: (id: string) => void;
    unknown: { title: string; line: string; checked: boolean };
    onUnknown: () => void;
  };
};

/** The count of a deposit on the phone; `gap` opens the rest of the mockups' second screen. */
export function DepartmentDepositMobile({
  title,
  line,
  counted,
  onCount,
  countedLabel,
  confirmLabel,
  onConfirm,
  disabled,
  notice,
  onClose,
  gapAction,
  gap,
}: DepartmentDepositProps) {
  return (
    <Screen
      bottom={
        <DepositBottom>
          <Button disabled={disabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          {gapAction && (
            <Button variant="secondary" onClick={gapAction.onClick}>
              {gapAction.label}
            </Button>
          )}
        </DepositBottom>
      }
    >
      <NavBar
        leading={
          <IconButton
            icon="x"
            label="Fermer"
            size="lg"
            iconSize={22}
            onClick={onClose}
          />
        }
        title={title}
        className={CLOSE_BAR}
      />
      <p className="mt-4 text-center text-15 text-muted">{line}</p>
      {notice && (
        <PhoneBanner
          tone="orange"
          icon="warning"
          className="mt-3"
          title={notice.title}
          description={notice.description}
          height={67}
        />
      )}
      <DepositCounter
        value={counted}
        alert={Boolean(gap)}
        onChange={onCount}
        className="mt-[46px]"
      />
      {gap ? (
        <>
          <PhoneBanner
            tone="red"
            icon="warning"
            className="mt-3.5"
            title={gap.banner.title}
            description={gap.banner.description}
            height={67}
          />
          <div
            role="radiogroup"
            className="mt-[23px] grid h-11 grid-cols-3 rounded-full bg-fill-2 p-0.5"
          >
            {gap.kinds.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={id === gap.kind}
                onClick={() => gap.onKind(id)}
                className={cn(
                  'cursor-pointer rounded-[20px] text-14 font-semibold',
                  id === gap.kind ? 'bg-ink text-on-ink' : 'text-ink-2',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4">
            {gap.parcels.map((parcel) => (
              <button
                key={parcel.id}
                type="button"
                className="block w-full cursor-pointer text-left"
                onClick={() => gap.onParcel(parcel.id)}
              >
                <PhoneRow
                  leading={<KraftThumb />}
                  title={parcel.title}
                  lines={[parcel.line]}
                  mark={<TickMark checked={parcel.checked} />}
                  separator
                />
              </button>
            ))}
            <button
              type="button"
              className="block w-full cursor-pointer text-left"
              onClick={gap.onUnknown}
            >
              <PhoneRow
                leading={<RoundTile icon="info" />}
                title={gap.unknown.title}
                lines={[gap.unknown.line]}
                mark={<TickMark checked={gap.unknown.checked} />}
              />
            </button>
          </div>
        </>
      ) : (
        <p className="mt-2 text-center text-17 font-semibold">{countedLabel}</p>
      )}
    </Screen>
  );
}

export type DepartmentDepositRow = {
  id: string;
  at: string;
  by: string;
  count: number;
  state: string;
  tone: 'orange' | 'green' | 'red';
};

export type DepartmentDepositsProps = {
  title: string;
  subtitle: string;
  label: string;
  empty: string;
  rows: readonly DepartmentDepositRow[];
  columns: { at: string; by: string; count: string; state: string };
  onRow: (id: string) => void;
};

/** The deposits of the department, wherever it reads them: the table goes full width. */
export function DepartmentDepositsContent({
  title,
  subtitle,
  label,
  empty,
  rows,
  columns,
  onRow,
}: DepartmentDepositsProps) {
  return (
    <>
      <DeskPageHeader title={title} subtitle={subtitle} />
      {rows.length ? (
        <DeskTable
          label={label}
          columns={[
            {
              key: 'at',
              header: columns.at,
              width: 200,
              cell: (d: DepartmentDepositRow) => (
                <button
                  type="button"
                  className="cursor-pointer font-semibold"
                  onClick={() => onRow(d.id)}
                >
                  {d.at}
                </button>
              ),
            },
            { key: 'by', header: columns.by, width: 200, cell: (d) => d.by },
            { key: 'count', header: columns.count, width: 100, cell: (d) => d.count },
            {
              key: 'state',
              header: columns.state,
              cell: (d) => <StatusDot size="sm" tone={d.tone} label={d.state} />,
            },
          ]}
          rows={[...rows]}
          rowKey={(d) => d.id}
        />
      ) : (
        <p className="text-15 text-muted">{empty}</p>
      )}
    </>
  );
}
