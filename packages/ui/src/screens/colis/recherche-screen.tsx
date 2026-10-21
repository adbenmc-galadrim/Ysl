import { Chip, ChipGroup } from '#components/chip';
import { NavBarAction } from '#components/nav-bar';
import {
  ParcelSection,
  type ParcelSectionProps,
} from '#components/parcel-section';
import { Screen } from '#components/screen';
import { SearchField } from '#components/search-field';

export type RechercheFilter = { label: string; selected?: boolean };

export type RechercheScreenProps = {
  query: string;
  filters: RechercheFilter[];
  /** Results, grouped by where the parcel stands. */
  sections: Omit<ParcelSectionProps, 'className'>[];
  /** What the search looks into, under the results. */
  hint?: string;
  onQueryChange?: (query: string) => void;
  onCancel?: () => void;
};

/**
 * Search. It looks through handed-over parcels too, because the question at
 * the desk is as often "did I already give it to her?" as "where is it?".
 */
export function RechercheScreen({
  query,
  filters,
  sections,
  hint,
  onQueryChange,
  onCancel,
}: RechercheScreenProps) {
  return (
    <Screen>
      <div className="-mt-0.5 flex items-center gap-0.5">
        <SearchField
          size="bar"
          value={query}
          onChange={(e) => onQueryChange?.(e.target.value)}
          onClear={() => onQueryChange?.('')}
        />
        {/* As wide as Penpot's text box, so the field keeps its width. */}
        <NavBarAction
          tone="blue"
          onClick={onCancel}
          className="w-[70px] text-right font-medium"
        >
          Annuler
        </NavBarAction>
      </div>
      <ChipGroup label="Filtres" layout="scroll" className="mt-4">
        {filters.map((filter) => (
          <Chip key={filter.label} selected={filter.selected}>
            {filter.label}
          </Chip>
        ))}
      </ChipGroup>
      {sections.map((section, s) => (
        <ParcelSection
          key={section.title}
          {...section}
          className={s ? 'mt-[29px]' : 'mt-6'}
        />
      ))}
      {hint && (
        <p className="mt-[35px] px-4 text-center text-13 leading-[1.4] text-muted">
          {hint}
        </p>
      )}
    </Screen>
  );
}
