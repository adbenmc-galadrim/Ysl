import { useState } from 'react';

import { Banner } from '#components/banner';
import { Button } from '#components/button';
import { Chip, ChipGroup } from '#components/chip';
import { Sheet } from '#components/sheet';

export type RetourExpediteurSheetProps = {
  /** Why it has waited, for a parcel someone was told about. */
  waiting?: { title: string; description?: string };
  reasons: { id: string; label: string }[];
  reason: string;
  sender: string;
  /** What happens next: the leg to the shuttle, or the parcel gone at once. */
  next: { title: string; description: string };
  confirmLabel: string;
  error?: string;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onDismiss: () => void;
};

/** « Retour à l'expéditeur » (maquette 09), drawn over the record it was opened from. */
export function RetourExpediteurSheet({
  waiting,
  reasons,
  reason: initialReason,
  sender,
  next,
  confirmLabel,
  error,
  busy,
  onConfirm,
  onDismiss,
}: RetourExpediteurSheetProps) {
  const [reason, setReason] = useState(initialReason);
  return (
    <Sheet
      fixed
      title="Retour à l’expéditeur"
      className="pb-[calc(var(--safe-bottom)+16px)]"
      onDismiss={onDismiss}
    >
      {waiting && (
        <Banner
          tone="red"
          icon="clock"
          title={waiting.title}
          description={waiting.description}
          className="mt-2.5"
        />
      )}
      <p className="mt-4 text-13 font-medium text-muted">Motif</p>
      <ChipGroup label="Motif" className="mt-1.5">
        {reasons.map(({ id, label }) => (
          <Chip key={id} selected={id === reason} onClick={() => setReason(id)}>
            {label}
          </Chip>
        ))}
      </ChipGroup>
      <p className="mt-[22px] text-13 font-medium text-muted">Expéditeur</p>
      <p className="mt-1 text-17 font-medium">{sender}</p>
      <Banner
        tone="blue"
        icon="info"
        title={next.title}
        description={next.description}
        className="mt-3.5"
      />
      {error && (
        <p role="alert" className="mt-3 text-14 text-red">
          {error}
        </p>
      )}
      <Button
        block
        disabled={busy}
        className="mt-6"
        onClick={() => onConfirm(reason)}
      >
        {confirmLabel}
      </Button>
    </Sheet>
  );
}
