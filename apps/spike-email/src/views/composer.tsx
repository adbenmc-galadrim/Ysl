import { useEffect, useState } from 'react';
import { CASES } from '#/cases';
import {
  readComposition,
  saveComposition,
  type Composition,
} from '#/compose/draft';
import { buildUrl, splitAddresses, TARGETS, type Target } from '#/compose/urls';
import type { Journal, Trial } from '#/journal';
import { TrialSummary, VerdictForm } from '#/views/verdict';

const LEAVE_WINDOW_MS = 2_000;

function watchLeave(): Promise<boolean> {
  return new Promise((resolve) => {
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      done(true);
    };
    const timer = window.setTimeout(() => done(false), LEAVE_WINDOW_MS);
    function done(left: boolean) {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onHide);
      resolve(left);
    }
    document.addEventListener('visibilitychange', onHide);
  });
}

type ComposerProps = {
  journal: Journal;
};

export function Composer({ journal }: ComposerProps) {
  const [composition, setComposition] = useState<Composition>(() =>
    readComposition(localStorage),
  );
  const [caseId, setCaseId] = useState(CASES[0]?.id ?? '');
  const [lastId, setLastId] = useState<string>();

  useEffect(() => saveComposition(localStorage, composition), [composition]);

  const edit = (patch: Partial<Composition>) =>
    setComposition((current) => ({ ...current, ...patch }));

  const loadCase = () => {
    const chosen = CASES.find((item) => item.id === caseId);
    if (!chosen) return;
    edit({
      cc: '',
      bcc: '',
      ...chosen.build({ replyTo: composition.replyTo }),
      source: chosen.id,
    });
  };

  const record = (trial: Omit<Trial, 'id' | 'at'>): string => {
    const id = journal.add(trial);
    setLastId(id);
    return id;
  };

  const baseTrial = () => ({
    source: composition.source,
    recipients:
      splitAddresses(composition.to).length +
      splitAddresses(composition.cc).length +
      splitAddresses(composition.bcc).length,
    subjectLength: composition.subject.length,
    bodyLength: composition.body.length,
  });

  const onOpen = (target: Target, url: string) => () => {
    const id = record({ target, urlLength: url.length, ...baseTrial() });
    void watchLeave().then((left) => journal.update(id, { left }));
  };

  const last = journal.trials.find((trial) => trial.id === lastId);
  const urls = TARGETS.map(({ target, label }) => ({
    target,
    label,
    url: buildUrl(target, composition),
  }));

  return (
    <section className="panel">
      <fieldset>
        <legend>Destinataires</legend>
        <label>
          À
          <input
            type="email"
            multiple
            inputMode="email"
            autoComplete="email"
            placeholder="vous@exemple.fr, collegue@exemple.fr"
            value={composition.to}
            onChange={(event) => edit({ to: event.target.value })}
          />
        </label>
        <label>
          Cc
          <input
            type="email"
            multiple
            inputMode="email"
            value={composition.cc}
            onChange={(event) => edit({ cc: event.target.value })}
          />
        </label>
        <label>
          Cci
          <input
            type="email"
            multiple
            inputMode="email"
            value={composition.bcc}
            onChange={(event) => edit({ bcc: event.target.value })}
          />
        </label>
        <label>
          Adresse de réponse (agent)
          <input
            type="email"
            inputMode="email"
            value={composition.replyTo}
            onChange={(event) => edit({ replyTo: event.target.value })}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Contenu</legend>
        <div className="row">
          <select
            aria-label="Cas préparé"
            value={caseId}
            onChange={(event) => setCaseId(event.target.value)}
          >
            {CASES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={loadCase}>
            Charger le cas
          </button>
        </div>
        <label>
          Objet
          <input
            type="text"
            value={composition.subject}
            onChange={(event) =>
              edit({ subject: event.target.value, source: 'libre' })
            }
          />
        </label>
        <label>
          Corps
          <textarea
            rows={10}
            value={composition.body}
            onChange={(event) =>
              edit({ body: event.target.value, source: 'libre' })
            }
          />
        </label>
        <p className="status">
          Source : {composition.source} · objet {composition.subject.length}{' '}
          car. · corps {composition.body.length} car.
        </p>
      </fieldset>

      <fieldset>
        <legend>Ouvrir dans</legend>
        <div className="targets">
          {urls.map(({ target, label, url }) => (
            <a
              key={target}
              className="button target"
              href={url}
              onClick={onOpen(target, url)}
            >
              {label}
              <small>URL {url.length.toLocaleString('fr-FR')} car.</small>
            </a>
          ))}
        </div>
      </fieldset>

      {last && (
        <fieldset>
          <legend>Dernier essai</legend>
          <TrialSummary trial={last} />
          <VerdictForm key={last.id} journal={journal} trial={last} />
        </fieldset>
      )}
    </section>
  );
}
