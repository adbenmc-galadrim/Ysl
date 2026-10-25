import { BarChart } from '#components/bar-chart';
import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { Chip, ChipGroup } from '#components/chip';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { StatCard, type StatCardProps } from '#components/stat-card';

export const REPORT_PERIODS = ['Semaine', 'Mois', 'Trimestre'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export type RapportsScreenProps = {
  period: ReportPeriod;
  /** "Octobre 2026". */
  periodLabel: string;
  stats: StatCardProps[];
  /** Parcels received per day over the period. */
  perDay: number[];
  /** One line on the carriers' shares. */
  carriers: string;
  onPeriodChange?: (period: ReportPeriod) => void;
};

/**
 * The report the mailroom hands to facilities: how many parcels, how fast
 * they leave, how many linger. Exports sit in the thumb zone because that is
 * what the screen is opened for once a month.
 */
export function RapportsScreen({
  period,
  periodLabel,
  stats,
  perDay,
  carriers,
  onPeriodChange,
}: RapportsScreenProps) {
  return (
    <Screen
      bottomInset={104}
      bottom={
        <BottomBar surface="none" className="bg-surface pt-3">
          <Button
            variant="secondary"
            icon="download"
            iconSize={20}
            // Zero padding so the two buttons split the row 166 : 175 exactly.
            className="min-w-0 flex-[166_1_0px] gap-2 px-0 text-16"
          >
            Rapport PDF
          </Button>
          <Button className="min-w-0 flex-[175_1_0px] px-0">Exporter en CSV</Button>
        </BottomBar>
      }
    >
      <NavBar title="Rapports" />
      <ChipGroup label="Période" layout="scroll" className="mt-3">
        {REPORT_PERIODS.map((p) => (
          <Chip
            key={p}
            selected={p === period}
            onClick={() => onPeriodChange?.(p)}
            className="px-3.5"
          >
            {p}
          </Chip>
        ))}
      </ChipGroup>
      <p className="mt-5 text-15 text-muted">{periodLabel}</p>
      <div className="mt-2.5 grid grid-cols-2 gap-x-[9px] gap-y-3">
        {stats.map((stat, i) => (
          <StatCard key={i} {...stat} />
        ))}
      </div>
      <h2 className="mt-7 text-15 font-semibold">Colis reçus par jour</h2>
      <BarChart
        values={perDay}
        label={`Colis reçus par jour, ${periodLabel}`}
        className="mt-[11px]"
      />
      <p className="mt-[15px] text-13 leading-[1.4] text-muted">{carriers}</p>
    </Screen>
  );
}
