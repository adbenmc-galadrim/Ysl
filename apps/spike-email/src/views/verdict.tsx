import type { Journal, Trial, Verdict } from '#/journal';

const VERDICTS: readonly { verdict: Verdict; label: string }[] = [
  { verdict: 'ok', label: 'OK' },
  { verdict: 'partial', label: 'Partiel' },
  { verdict: 'ko', label: 'KO' },
];

export const TARGET_LABELS: Record<Trial['target'], string> = {
  mailto: 'Mail',
  outlook: 'Outlook',
  gmail: 'Gmail',
  share: 'Partage',
};

export function clock(at: number): string {
  return new Date(at).toLocaleTimeString('fr-FR');
}

export function TrialSummary({ trial }: { trial: Trial }) {
  const left =
    trial.left === undefined
      ? ''
      : trial.left
        ? ' · app quittée'
        : ' · resté ?';
  return (
    <p className="summary">
      <time>{clock(trial.at)}</time>{' '}
      <strong>{TARGET_LABELS[trial.target]}</strong> · {trial.source} ·{' '}
      {trial.bodyLength} car.
      {trial.urlLength === undefined ? '' : ` · URL ${trial.urlLength}`}
      {left}
      {trial.outcome ? ` · ${trial.outcome}` : ''}
    </p>
  );
}

export function VerdictForm({
  journal,
  trial,
}: {
  journal: Journal;
  trial: Trial;
}) {
  return (
    <div className="verdict">
      <div className="segmented" role="group" aria-label="Verdict">
        {VERDICTS.map(({ verdict, label }) => (
          <button
            key={verdict}
            type="button"
            aria-pressed={trial.verdict === verdict}
            data-verdict={verdict}
            onClick={() => journal.update(trial.id, { verdict })}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Note : ce qui est arrivé, où ça coupe…"
        defaultValue={trial.note ?? ''}
        onBlur={(event) =>
          journal.update(trial.id, { note: event.target.value })
        }
      />
    </div>
  );
}
