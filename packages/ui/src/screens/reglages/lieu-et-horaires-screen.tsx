import { useId } from 'react';

import { GroupedRow, GroupedSection } from '#components/grouped-list';
import { NavBarAction } from '#components/nav-bar';
import {
  SettingsGroupView,
  SettingsScreen,
  type SettingsGroup,
} from '#screens/reglages/settings-screen';

export type OpeningHours = { day: string; hours: string };

export type LieuEtHorairesScreenProps = {
  place: string;
  hours: OpeningHours[];
  /** Makes the place a text box. */
  onPlaceChange?: (place: string) => void;
  /** Makes each day's hours a text box; `index` is the day's in `hours`. */
  onHoursChange?: (index: number, hours: string) => void;
  /** What to bring or do at the desk; the card shows once this is given. */
  instructions?: string;
  onInstructionsChange?: (instructions: string) => void;
  /** The reminder rules, with the toggle that turns them off. */
  reminders?: SettingsGroup;
  /** The note under the last card, when the reminders do not carry it. */
  footer?: string;
  placeMaxLength?: number;
  hoursMaxLength?: number;
  instructionsMaxLength?: number;
  onBack?: () => void;
  onDone?: () => void;
};

const input =
  'min-w-0 bg-transparent text-16 outline-none placeholder:text-faint';

/**
 * Where and when to collect. Every e-mail quotes these lines, so they are
 * shown exactly as the recipient will read them, and typed in place: the
 * text box looks like the line it edits.
 */
export function LieuEtHorairesScreen({
  place,
  hours,
  onPlaceChange,
  onHoursChange,
  instructions,
  onInstructionsChange,
  reminders,
  footer,
  placeMaxLength,
  hoursMaxLength,
  instructionsMaxLength,
  onBack,
  onDone,
}: LieuEtHorairesScreenProps) {
  const id = useId();
  return (
    <SettingsScreen
      title="Lieu et horaires"
      onBack={onBack}
      trailing={<NavBarAction onClick={onDone}>OK</NavBarAction>}
      className="mt-4"
    >
      <GroupedSection header="Lieu de retrait">
        {onPlaceChange ? (
          <div className="flex h-[52px] px-4">
            <input
              aria-label="Lieu de retrait"
              value={place}
              maxLength={placeMaxLength}
              placeholder="Bâtiment, étage, comptoir"
              onChange={(event) => onPlaceChange(event.target.value)}
              className={`${input} mb-[3px] flex-1 text-ink`}
            />
          </div>
        ) : (
          <GroupedRow title={place} />
        )}
      </GroupedSection>
      <GroupedSection header="Horaires">
        {hours.map(({ day, hours: slots }, index) =>
          onHoursChange ? (
            <GroupedRow
              key={day}
              title={<label htmlFor={`${id}-${index}`}>{day}</label>}
              value={
                <input
                  id={`${id}-${index}`}
                  value={slots}
                  maxLength={hoursMaxLength}
                  placeholder="Fermé"
                  onChange={(event) => onHoursChange(index, event.target.value)}
                  className={`${input} w-52 text-right text-muted`}
                />
              }
            />
          ) : (
            <GroupedRow key={day} title={day} value={slots} />
          ),
        )}
      </GroupedSection>
      {reminders && <SettingsGroupView {...reminders} />}
      {instructions !== undefined && (
        <GroupedSection header="Consignes" footer={footer}>
          <textarea
            aria-label="Consignes"
            value={instructions}
            maxLength={instructionsMaxLength}
            rows={3}
            readOnly={!onInstructionsChange}
            placeholder="Pièce d’identité, badge, procuration…"
            onChange={(event) => onInstructionsChange?.(event.target.value)}
            className={`${input} block w-full resize-none px-4 py-3.5 leading-[1.35] text-ink`}
          />
        </GroupedSection>
      )}
    </SettingsScreen>
  );
}
