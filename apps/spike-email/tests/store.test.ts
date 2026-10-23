import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from '#/journal';
import { DEFAULT_TEMPLATE } from '#/templates/default';
import { TemplateStore } from '#/templates/store';

function memoryStore(initial?: string): KeyValueStore {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set('spike-email:templates', initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

function ids(): () => string {
  let next = 0;
  return () => `t${(next += 1)}`;
}

describe('TemplateStore', () => {
  it('creates, duplicates, edits and deletes, and keeps it all on reload', () => {
    const store = memoryStore();
    const templates = new TemplateStore(store, ids());
    const created = templates.create();
    templates.update(created.id, { name: 'Relance', subject: 'Rappel {code}' });
    const copy = templates.duplicate(created.id);
    templates.remove(copy?.id ?? '');

    const reloaded = new TemplateStore(store, ids());

    expect(reloaded.list().map((item) => item.id)).toEqual(['default', 't1']);
    expect(reloaded.get('t1')).toMatchObject({
      name: 'Relance',
      subject: 'Rappel {code}',
    });
    expect(copy?.name).toBe('Relance (copie)');
  });

  it('never deletes the default template and can restore it', () => {
    const templates = new TemplateStore(memoryStore(), ids());
    templates.update('default', { body: 'abîmé' });

    expect(templates.remove('default')).toBe(false);
    templates.resetDefault();
    expect(templates.get('default')).toEqual(DEFAULT_TEMPLATE);
  });

  it('falls back to the default template when storage is damaged', () => {
    for (const raw of ['{oops', 'null', '[{"id":1}]']) {
      expect(new TemplateStore(memoryStore(raw)).list()).toEqual([
        DEFAULT_TEMPLATE,
      ]);
    }
  });
});
