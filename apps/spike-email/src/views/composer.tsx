import { useEffect, useState } from 'react';
import { CASES } from '#/cases';
import {
  readComposition,
  saveComposition,
  type Composition,
} from '#/compose/draft';
import { buildUrl, splitAddresses, TARGETS, type Target } from '#/compose/urls';
import type { Journal, Trial } from '#/journal';
import { canShareFile, loadQrFile, shareWithQr } from '#/share/qr';
import {
  render,
  templateValues,
  type TemplateFields,
} from '#/templates/render';
import type { TemplateStore } from '#/templates/store';
import { TrialSummary, VerdictForm } from '#/views/verdict';

const LEAVE_WINDOW_MS = 2_000;

const FIELD_LABELS: Record<keyof TemplateFields, string> = {
  prénom: 'Prénom',
  nom: 'Nom',
  code: 'Code de retrait',
  colis: 'Colis (un par ligne)',
  lieu: 'Lieu',
  horaires: 'Horaires',
  agent: 'Signature',
};

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
  templates: TemplateStore;
};

export function Composer({ journal, templates }: ComposerProps) {
  const [composition, setComposition] = useState<Composition>(() =>
    readComposition(localStorage),
  );
  const [caseId, setCaseId] = useState(CASES[0]?.id ?? '');
  const [unknown, setUnknown] = useState<string[]>([]);
  const [qr, setQr] = useState<File>();
  const [qrError, setQrError] = useState<string>();

  useEffect(() => saveComposition(localStorage, composition), [composition]);

  useEffect(() => {
    loadQrFile().then(setQr, (error: unknown) =>
      setQrError(error instanceof Error ? error.message : String(error)),
    );
  }, []);

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

  const template = templates.get(composition.templateId) ?? templates.list()[0];

  const applyTemplate = () => {
    if (!template) return;
    const values = templateValues(composition.fields, composition.replyTo);
    const subject = render(template.subject, values);
    const body = render(template.body, values);
    setUnknown([...new Set([...subject.unknown, ...body.unknown])]);
    edit({
      subject: subject.text,
      body: body.text,
      source: `modèle ${template.name}`,
    });
  };

  const editField = (name: keyof TemplateFields, value: string) =>
    edit({ fields: { ...composition.fields, [name]: value } });

  const record = (trial: Omit<Trial, 'id' | 'at'>): string => {
    const id = journal.add(trial);
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

  const onShare = () => {
    const id = record({ target: 'share', ...baseTrial() });
    if (!qr) {
      journal.update(id, { outcome: qrError ?? 'QR non chargé' });
      return;
    }
    void shareWithQr(qr, composition.subject, composition.body).then(
      (outcome) => journal.update(id, { outcome }),
    );
  };

  const last = journal.trials.at(-1);
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
        <legend>Modèle</legend>
        <div className="row">
          <select
            aria-label="Modèle"
            value={template?.id}
            onChange={(event) => edit({ templateId: event.target.value })}
          >
            {templates.list().map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={applyTemplate}>
            Appliquer
          </button>
        </div>
        <details>
          <summary>Valeurs des variables</summary>
          <div className="fields">
            {(Object.keys(FIELD_LABELS) as (keyof TemplateFields)[]).map(
              (name) => (
                <label key={name}>
                  {FIELD_LABELS[name]}
                  {name === 'colis' ? (
                    <textarea
                      rows={3}
                      value={composition.fields[name]}
                      onChange={(event) => editField(name, event.target.value)}
                    />
                  ) : (
                    <input
                      type="text"
                      value={composition.fields[name]}
                      onChange={(event) => editField(name, event.target.value)}
                    />
                  )}
                </label>
              ),
            )}
          </div>
        </details>
        {unknown.length > 0 && composition.source.startsWith('modèle') && (
          <p className="warning">
            Variables inconnues, laissées telles quelles :{' '}
            {unknown.map((name) => `{${name}}`).join(', ')}
          </p>
        )}
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
          <button type="button" className="target" onClick={onShare}>
            Partager avec le QR
            <small>
              {qrError ??
                (qr && !canShareFile(qr)
                  ? 'partage de fichiers indisponible'
                  : 'feuille de partage, PNG joint')}
            </small>
          </button>
        </div>
      </fieldset>

      {last && (
        <fieldset>
          <legend>Dernier essai</legend>
          <TrialSummary trial={last} reloaded={journal.reloadedAfter(last)} />
          <VerdictForm
            key={`${last.id}-${last.note ?? ''}`}
            journal={journal}
            trial={last}
          />
        </fieldset>
      )}
    </section>
  );
}
