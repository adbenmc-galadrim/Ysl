import { useState } from 'react';
import { DEFAULT_TEMPLATE_ID } from '#/templates/default';
import { render, VARIABLES } from '#/templates/render';
import type { TemplateStore } from '#/templates/store';

type TemplatesViewProps = {
  templates: TemplateStore;
  onChange: () => void;
};

const KNOWN = Object.fromEntries(VARIABLES.map((name) => [name, name]));

export function TemplatesView({ templates, onChange }: TemplatesViewProps) {
  const [selectedId, setSelectedId] = useState(DEFAULT_TEMPLATE_ID);
  const [revision, setRevision] = useState(0);
  const selected =
    templates.get(selectedId) ?? templates.get(DEFAULT_TEMPLATE_ID);
  if (!selected) return null;

  const unknown = [
    ...new Set([
      ...render(selected.subject, KNOWN).unknown,
      ...render(selected.body, KNOWN).unknown,
    ]),
  ];
  const isDefault = selected.id === DEFAULT_TEMPLATE_ID;

  const act = (action: () => string | undefined) => {
    const next = action();
    if (next) setSelectedId(next);
    onChange();
  };

  const onRemove = () => {
    if (!window.confirm(`Supprimer le modèle « ${selected.name} » ?`)) return;
    act(() =>
      templates.remove(selected.id) ? DEFAULT_TEMPLATE_ID : undefined,
    );
  };

  const onReset = () => {
    if (!window.confirm('Rétablir le modèle par défaut ?')) return;
    act(() => {
      templates.resetDefault();
      setRevision((value) => value + 1);
      return undefined;
    });
  };

  return (
    <section className="panel">
      <div className="row">
        <select
          aria-label="Modèle"
          value={selected.id}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {templates.list().map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div className="actions">
        <button type="button" onClick={() => act(() => templates.create().id)}>
          Nouveau
        </button>
        <button
          type="button"
          onClick={() => act(() => templates.duplicate(selected.id)?.id)}
        >
          Dupliquer
        </button>
        {isDefault ? (
          <button type="button" onClick={onReset}>
            Rétablir
          </button>
        ) : (
          <button type="button" onClick={onRemove}>
            Supprimer
          </button>
        )}
      </div>

      <fieldset key={`${selected.id}-${revision}`}>
        <legend>Modèle</legend>
        <label>
          Nom
          <input
            type="text"
            defaultValue={selected.name}
            onChange={(event) =>
              act(() => {
                templates.update(selected.id, { name: event.target.value });
                return undefined;
              })
            }
          />
        </label>
        <label>
          Objet
          <input
            type="text"
            defaultValue={selected.subject}
            onChange={(event) =>
              act(() => {
                templates.update(selected.id, { subject: event.target.value });
                return undefined;
              })
            }
          />
        </label>
        <label>
          Corps
          <textarea
            rows={14}
            defaultValue={selected.body}
            onChange={(event) =>
              act(() => {
                templates.update(selected.id, { body: event.target.value });
                return undefined;
              })
            }
          />
        </label>
        {unknown.length > 0 && (
          <p className="warning">
            Variables inconnues, laissées telles quelles dans l’e-mail :{' '}
            {unknown.map((name) => `{${name}}`).join(', ')}
          </p>
        )}
      </fieldset>

      <p className="muted">
        Variables : {VARIABLES.map((name) => `{${name}}`).join(' ')}
      </p>
    </section>
  );
}
