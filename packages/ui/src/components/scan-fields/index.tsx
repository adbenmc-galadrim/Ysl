import type { ReactNode } from 'react';

import { Icon } from '#icons';
import { cn, tv, type VariantProps } from '#lib/tv';

/** How sure the reading is: read, read but doubtful, not read. */
export type ScanFieldStatus = 'ok' | 'warning' | 'error';

export type ScanField = {
  label: ReactNode;
  value: ReactNode;
  status?: ScanFieldStatus;
  /** Tracking numbers: set in the mono face so groups line up. */
  mono?: boolean;
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
  },
  variants: {
    tone: {
      dark: {
        root: 'gap-3',
        row: '*:first:mr-2.5',
        label: 'w-[100px] text-night-muted',
        value: 'text-white',
      },
      light: {
        root: 'gap-[15px]',
        // The 16 px icon is centred on the 20 px column of the rows above.
        row: 'pl-0.5 *:first:mr-2',
        label: 'w-[104px] text-muted',
        value: 'text-ink',
      },
    },
  },
  defaultVariants: { tone: 'dark' },
});

const STATUS = {
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

/**
 * What was read off the label, one line per field with its status in front:
 * carrier, tracking, recipient. The icons form a column, so a doubtful field
 * stands out before the line is read.
 */
export function ScanFields({ fields, tone = 'dark', className }: ScanFieldsProps) {
  const s = scanFieldsVariants({ tone });
  const hue = STATUS[tone ?? 'dark'];
  return (
    <dl className={s.root({ class: className })}>
      {fields.map((field, i) => {
        const status = field.status ?? 'ok';
        return (
          <div key={i} className={s.row()}>
            <Icon
              name={status === 'ok' ? 'check' : 'alert'}
              size={tone === 'light' ? 16 : 18}
              aria-label={status === 'ok' ? 'Lu' : 'À vérifier'}
              aria-hidden={undefined}
              role="img"
              className={cn('shrink-0', hue[status])}
            />
            <dt className={s.label()}>{field.label}</dt>
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
          </div>
        );
      })}
    </dl>
  );
}
