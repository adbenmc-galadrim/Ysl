import { Banner } from '#components/banner';
import { Button } from '#components/button';
import { DeskPageHeader } from '#components/company-shell';
import { DeskPanel, DeskStats } from '#components/desk-panel';
import { DeskTable, type DeskTableColumn } from '#components/desk-table';
import { SettingsIcon } from '#components/grouped-list';
import { IconButton } from '#components/icon-button';
import { LargeTitle } from '#components/large-title';
import { PhoneGroupTitle, PhoneStat } from '#components/phone-parts';
import { Screen } from '#components/screen';
import { StatusDot } from '#components/status-dot';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

export type OverviewToResolve = {
  id: string;
  name: string;
  department: string;
  reason: string;
  since: string;
};

export type OverviewLine = {
  id: string;
  name: string;
  coming: string;
  waiting: string;
  late: string;
  blocked: string;
  deposit?: string;
  delay: string;
};

export type OverviewProps = {
  subtitle: string;
  stats: {
    coming: string;
    waiting: string;
    late: string;
    blocked: string;
    handedToday: string;
  };
  /** How many wait, when the list shows only the first of them. */
  blockedCount: number;
  toResolve: OverviewToResolve[];
  lines: OverviewLine[];
  /** The figures could not be refreshed: they stay, said to be old. */
  stale?: { title: string; description: string; onRetry: () => void };
  onResolve: (id: string) => void;
  onResolveAll: () => void;
  onOpenLine: (id: string) => void;
};

export function StaleBanner({
  stale,
  className,
}: {
  stale: NonNullable<OverviewProps['stale']>;
  className?: string;
}) {
  return (
    <Banner
      tone="grey"
      icon="wifiOff"
      title={stale.title}
      description={stale.description}
      onClick={stale.onRetry}
      className={className}
    />
  );
}

function figure(
  key: keyof OverviewLine,
  header: string,
  width: number,
  tone?: string,
): DeskTableColumn<OverviewLine> {
  return {
    key,
    header,
    width,
    cell: (line) => (
      <span
        className={cn(
          'ml-auto pr-6',
          line[key] !== '—' && tone && `font-semibold ${tone}`,
        )}
      >
        {line[key]}
      </span>
    ),
  };
}

const COLUMNS: DeskTableColumn<OverviewLine>[] = [
  {
    key: 'name',
    header: 'Département',
    width: 220,
    cell: (line) => <span className="font-semibold">{line.name}</span>,
  },
  figure('coming', 'En route', 120),
  figure('waiting', 'En attente', 130),
  figure('late', 'En souffrance', 140, 'text-orange'),
  figure('blocked', 'À régulariser', 140, 'text-red'),
  {
    key: 'deposit',
    header: 'Dépôt à confirmer',
    width: 190,
    cell: (line) =>
      line.deposit ? (
        <StatusDot size="sm" tone="orange" label={line.deposit} />
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  {
    key: 'delay',
    header: 'Délai moyen',
    cell: (line) => <span className="ml-auto pr-[54px]">{line.delay}</span>,
  },
];

/** What a company's administrator opens first, inside `CompanyShell`: today's figures and what blocks. */
export function VueDEnsembleDesktop({
  subtitle,
  stats,
  blockedCount,
  toResolve,
  lines,
  stale,
  onResolve,
  onResolveAll,
  onOpenLine,
}: OverviewProps) {
  return (
    <>
      <DeskPageHeader title="Vue d’ensemble" subtitle={subtitle} />
      {stale && <StaleBanner stale={stale} className="my-3" />}
      <DeskStats
        stats={[
          { label: 'En route', value: stats.coming },
          { label: 'En attente de retrait', value: stats.waiting },
          { label: 'En souffrance', value: stats.late, tone: 'orange' },
          { label: 'À régulariser', value: stats.blocked, tone: 'red' },
          { label: 'Remis aujourd’hui', value: stats.handedToday },
        ]}
      />
      {toResolve.length > 0 && (
        <DeskPanel
          title={`À régulariser · ${blockedCount}`}
          action={
            <button type="button" onClick={onResolveAll}>
              Tout voir
            </button>
          }
          className="mt-5 pb-1.5"
        >
          {toResolve.map((item, i) => (
            <div
              key={item.id}
              className={cn(
                'relative mx-[15px] flex h-12 shrink-0 items-start text-13',
                i < toResolve.length - 1 && 'border-b border-separator',
              )}
            >
              <Icon name="warning" size={16} className="mt-[15px] text-red" />
              <span className="mt-[13px] ml-3 w-[156px] truncate font-semibold">
                {item.name}
              </span>
              <span className="mt-[13px] w-[120px] truncate text-ink-2">
                {item.department}
              </span>
              <span className="mt-[13px] w-[300px] truncate text-ink-2">
                {item.reason}
              </span>
              <span className="mt-[13px] text-muted">{item.since}</span>
              <Button
                variant="outline"
                size="desk"
                className="absolute top-2 right-0 w-24"
                onClick={() => onResolve(item.id)}
              >
                Réaffecter
              </Button>
            </div>
          ))}
        </DeskPanel>
      )}
      <h2 className="mt-4 text-15 font-semibold">Par département</h2>
      <DeskTable
        label="Par département"
        className="mt-2.5 shrink-0"
        columns={COLUMNS}
        rows={lines}
        rowKey={(line) => line.id}
        onRowClick={(line) => onOpenLine(line.id)}
      />
      <p className="mt-[27px] text-12 text-muted">
        Une ligne ouvre les colis du département. Orange : attend une action ;
        rouge : bloque.
      </p>
    </>
  );
}

/** The same figures on the phone, and who has to be dealt with. */
export function VueDEnsembleMobile({
  subtitle,
  stats,
  toResolve,
  stale,
  onResolve,
  onMenu,
}: OverviewProps & { onMenu: () => void }) {
  const figures = stale ? 'opacity-60' : undefined;
  return (
    <Screen tone="fill" className="pt-[calc(var(--safe-top)+6px)]">
      <div className="flex h-11 items-center justify-end">
        <IconButton
          icon="menu"
          label="Menu"
          size="lg"
          iconSize={22}
          className="-mr-0.5 bg-surface"
          onClick={onMenu}
        />
      </div>
      <LargeTitle
        title={<span className="tracking-[-0.4px]">Vue d’ensemble</span>}
        subtitle={subtitle}
        className="mt-[7px] gap-1.5"
      />
      {stale && <StaleBanner stale={stale} className="mt-3.5" />}
      <div className="mt-3.5 grid grid-cols-2 gap-x-[11px] gap-y-3">
        <PhoneStat label="En route" value={stats.coming} className={figures} />
        <PhoneStat label="En attente" value={stats.waiting} className={figures} />
        <PhoneStat
          label="En souffrance"
          value={stats.late}
          tone="orange"
          className={figures}
        />
        <PhoneStat
          label="À régulariser"
          value={stats.blocked}
          tone="red"
          className={figures}
        />
      </div>
      {toResolve.length > 0 && (
        <>
          <PhoneGroupTitle className="mt-7">À régulariser</PhoneGroupTitle>
          <div className="mt-1.5 rounded-[14px] bg-surface">
            {toResolve.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onResolve(item.id)}
                className="relative block h-16 w-full text-left"
              >
                {i > 0 && (
                  <div className="absolute -top-px right-0 left-14 h-px bg-separator" />
                )}
                <SettingsIcon
                  icon="warning"
                  className="absolute top-[18px] left-3.5 bg-red"
                />
                <p className="absolute top-3 right-9 left-14 truncate text-16 font-semibold">
                  {item.name}
                </p>
                <p className="absolute top-[34px] right-9 left-14 truncate text-13 text-muted">
                  {item.department} · {item.reason}
                </p>
                <Icon
                  name="chevron"
                  size={16}
                  className="absolute top-6 right-3.5 text-faint"
                />
              </button>
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}
