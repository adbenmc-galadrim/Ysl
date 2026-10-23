import { useState } from 'react';
import { exportJournal } from '#/export';
import type { Journal } from '#/journal';
import { TrialSummary, VerdictForm } from '#/views/verdict';

export function JournalView({ journal }: { journal: Journal }) {
  const [status, setStatus] = useState<string>();
  const trials = [...journal.trials].reverse();

  const onExport = async () => {
    try {
      setStatus(`Journal ${await exportJournal(journal)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const onClear = () => {
    if (window.confirm('Effacer tous les essais du journal ?')) journal.clear();
  };

  return (
    <section className="panel">
      <dl className="device">
        {Object.entries(journal.device).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>
      {journal.notSaved && (
        <p className="warning">
          Le journal n’a pas pu être enregistré : l’exporter avant de quitter.
        </p>
      )}
      <div className="actions">
        <button
          type="button"
          className="primary"
          onClick={() => void onExport()}
        >
          Exporter le journal
        </button>
        <button type="button" onClick={onClear}>
          Effacer
        </button>
      </div>
      {status && <p className="status">{status}</p>}
      {trials.length === 0 && (
        <p className="muted">Aucun essai pour l’instant.</p>
      )}
      <ol className="trials">
        {trials.map((trial) => (
          <li key={trial.id}>
            <TrialSummary trial={trial} />
            <VerdictForm journal={journal} trial={trial} />
          </li>
        ))}
      </ol>
    </section>
  );
}
