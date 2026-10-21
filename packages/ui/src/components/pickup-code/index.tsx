import type { ReactNode } from 'react';

import { QrCode } from '#components/qr-code';
import { cn } from '#lib/tv';

export type PickupCodeProps = {
  /** The four digits said at the desk when the QR cannot be shown. */
  code: string;
  qr: string[];
  label?: ReactNode;
  /** How long the code holds: "Valable jusqu’au retrait". */
  validity?: ReactNode;
  className?: string;
};

/**
 * The pickup code as the employee carries it: the QR to show and the same
 * code in big spaced digits to read out, side by side, so either works at
 * the counter.
 */
export function PickupCode({
  code,
  qr,
  label = 'Code de retrait',
  validity,
  className,
}: PickupCodeProps) {
  return (
    <div className={cn('flex gap-5 rounded-card bg-fill p-5', className)}>
      <QrCode matrix={qr} label={`QR code de retrait ${code}`} />
      <div className="flex min-w-0 flex-col pt-2.5">
        <span className="text-13 text-muted">{label}</span>
        <span className="mt-1 font-mono text-34 font-semibold tracking-[4px] text-ink">
          {code}
        </span>
        {validity && (
          <span className="mt-[9px] text-13 text-muted">{validity}</span>
        )}
      </div>
    </div>
  );
}
