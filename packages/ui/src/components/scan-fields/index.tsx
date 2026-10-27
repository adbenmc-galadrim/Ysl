import type { ReactNode } from 'react';

import { Icon } from '#icons';
import { cn, tv, type VariantProps } from '#lib/tv';

/**
 * How sure the reading is (§4.4): read (≥ 0,90), read but doubtful
 * (0,60 to 0,90), not read (below 0,60).
 */
export type ScanFieldStatus = 'ok' | 'warning' | 'error';

/** A value the reader half saw, for the agent to pick when the field stays empty. */
export type ScanSuggestion = {
  label: ReactNode;
  /** Absent over the camera: the chips only say what was seen. */
  onPick?: () => void;
  /** Accessible name of the pick: "Choisir 1Z E63…". */
  pickLabel?: string;
};

export type ScanField = {
  label: ReactNode;
  value: ReactNode;
  status?: ScanFieldStatus;
  /** Tracking numbers: set in the mono face so groups line up. */
  mono?: boolean;
  /** Below « à vérifier » the field is empty and offers these instead (§4.4). */
  suggestions?: ScanSuggestion[];
  /** Opens the diagnostic on this field: « D'où vient cette valeur ? » (§6.4). */
  onExplain?: () => void;
};

/**
 * `dark` over the camera (iOS system hues, 18 px icons), `light` on a white
 * screen (the app's own hues, 16 px icons). The value takes the status
 * colour when it is doubtful, so "Camille Morel ?" reads as a question.
 */
export const scanFieldsVariants = tv({
  slots: {
    root: 'flex flex-col',
    // Rows keep the text's 17 px; the 18 px icon overhangs instead of
    // pushing the pitch to 30.
    row: 'flex h-[17px] items-center text-14',
    label: 'shrink-0 truncate',
    value: 'min-w-0 truncate font-medium',
    chips: 'flex min-w-0 flex-wrap gap-1.5',
    chip: 'inline-flex h-7 max-w-full items-center truncate rounded-chip px-2.5 text-13 font-medium',
  },
  variants: {
    tone: {
      dark: {
        root: 'gap-3',
        row: '*:first:mr-2.5',
        label: 'w-[100px] text-night-muted',
        value: 'text-white',
        chip: 'bg-white/15 text-white',
      },
      light: {
        root: 'gap-[15px]',
        // The 16 px icon is centred on the 20 px column of the rows above.
        row: 'pl-0.5 *:first:mr-2',
        label: 'w-[104px] text-muted',
        value: 'text-ink',
        chip: 'bg-surface text-ink ring-1 ring-border ring-inset',
      },
    },
  },
  defaultVariants: { tone: 'dark' },
});

/** The hue of a status per tone, shared with the band of the last parcel. */
export const SCAN_FIELD_STATUS = {
  dark: {
    ok: 'text-ios-green-dark',
    warning: 'text-ios-orange',
    error: 'text-ios-red',
  },
  light: { ok: 'text-green', warning: 'text-orange', error: 'text-red' },
} as const;

export type ScanFieldsProps = VariantProps<typeof scanFieldsVariants> & {
  fields: ScanField[];
  className?: string;
};

const STATUS_LABEL: Record<ScanFieldStatus, string> = {
  ok: 'Lu',
  warning: 'À vérifier',
  error: 'Non lu',
};

/**
 * What was read off the label, one line per field with its status in front:
 * carrier, tracking, recipient. The icons form a column, so a doubtful field
 * stands out before the line is read: a tick « Lu », an alert « À vérifier »
 * with a « ? » after the value, or, when nothing is sure enough, an empty
 * field and the best suggestions as chips (§4.4).
 */
export function ScanFields({
  fields,
  tone = 'dark',
  className,
}: ScanFieldsProps) {
  const s = scanFieldsVariants({ tone });
  const hue = SCAN_FIELD_STATUS[tone ?? 'dark'];
  return (
    <dl className={s.root({ class: className })}>
      {fields.map((field, i) => {
        const status = field.status ?? 'ok';
        const suggestions = field.suggestions ?? [];
        return (
          <div
            key={i}
            className={s.row({
              class: suggestions.length > 0 && 'h-auto min-h-[17px]',
            })}
          >
            <Icon
              name={status === 'ok' ? 'check' : 'alert'}
              size={tone === 'light' ? 16 : 18}
              aria-label={STATUS_LABEL[status]}
              aria-hidden={undefined}
              role="img"
              className={cn('shrink-0', hue[status])}
            />
            <dt className={s.label()}>{field.label}</dt>
            {suggestions.length > 0 ? (
              <dd className={s.chips()}>
                {suggestions.map((suggestion, j) =>
                  suggestion.onPick ? (
                    <button
                      key={j}
                      type="button"
                      aria-label={suggestion.pickLabel}
                      onClick={suggestion.onPick}
                      className={s.chip({
                        class: [
                          field.mono && 'font-mono',
                          'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue',
                        ],
                      })}
                    >
                      {suggestion.label}
                    </button>
                  ) : (
                    <span
                      key={j}
                      className={s.chip({ class: field.mono && 'font-mono' })}
                    >
                      {suggestion.label}
                    </span>
                  ),
                )}
              </dd>
            ) : (
              <dd
                className={s.value({
                  class: [
                    field.mono && 'font-mono',
                    status !== 'ok' && hue[status],
                  ],
                })}
              >
                {field.value}
              </dd>
            )}
            {field.onExplain && (
              <button
                type="button"
                aria-label="D’où vient cette valeur ?"
                onClick={field.onExplain}
                className={cn(
                  // 44 px to the finger, 16 px to the eye, on the 17 px pitch.
                  '-my-[13.5px] -mr-3.5 ml-auto flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue',
                  tone === 'light' ? 'text-muted' : 'text-night-muted',
                )}
              >
                <Icon name="info" size={16} />
              </button>
            )}
          </div>
        );
      })}
    </dl>
  );
}
