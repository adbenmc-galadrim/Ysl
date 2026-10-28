import 'fake-indexeddb/auto';
import { DEFAULT_TEMPLATES, presetTemplateId } from '@repo/contract/mail';
import { isUuidV7 } from '@repo/shared/id';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  createTemplate,
  DefaultTemplateError,
  deleteTemplate,
  duplicateTemplate,
  isPreset,
  listTemplates,
  restoreDefault,
  saveTemplate,
} from '#/features/mail/templates';
import { NOW, openTestDatabase } from './helpers/local-rows';

const options = { userId: 'agent-1', now: NOW };

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

describe('e-mail templates', () => {
  it('offers the default template before anything is stored, under one id per agent', async () => {
    const [preset] = await listTemplates(db, 'agent-1');
    expect(preset).toMatchObject({
      ...DEFAULT_TEMPLATES.avis,
      isDefault: true,
      stored: false,
    });
    expect(preset?.id).toBe(await presetTemplateId('agent-1', 'avis'));
    expect(isUuidV7(preset!.id)).toBe(true);
    expect(await presetTemplateId('agent-2', 'avis')).not.toBe(preset?.id);
    expect(await db.outbox.count()).toBe(0);
  });

  it('writes the default template the first time it changes, under that same id', async () => {
    const [preset] = await listTemplates(db, 'agent-1');
    await saveTemplate(
      db,
      preset!,
      { ...preset!, body: 'Bonjour {prénom}' },
      options,
    );

    const templates = await listTemplates(db, 'agent-1');
    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({
      id: preset?.id,
      body: 'Bonjour {prénom}',
      stored: true,
    });
    const [op] = await db.outbox.toArray();
    expect(op).toMatchObject({
      entity: 'email_template',
      entityId: preset?.id,
    });
    expect(op?.patch).toMatchObject({ ownerId: 'agent-1', isDefault: true });
  });

  it('restores the shipped text on the same row, and refuses to delete it', async () => {
    const [preset] = await listTemplates(db, 'agent-1');
    const changed = await saveTemplate(
      db,
      preset!,
      { ...preset!, subject: 'Autre' },
      options,
    );
    expect(isPreset(changed)).toBe(false);

    const restored = await restoreDefault(db, changed, options);

    expect(restored).toMatchObject({
      id: preset?.id,
      ...DEFAULT_TEMPLATES.avis,
    });
    expect(isPreset(restored)).toBe(true);
    await expect(deleteTemplate(db, restored)).rejects.toBeInstanceOf(
      DefaultTemplateError,
    );
  });

  it('creates, duplicates and deletes the agent’s own, hiding a colleague’s', async () => {
    const [preset] = await listTemplates(db, 'agent-1');
    const relance = await createTemplate(db, 'Relance', options);
    const copy = await duplicateTemplate(db, preset!, 'Avis (copie)', options);
    await createTemplate(db, 'Le sien', { ...options, userId: 'agent-2' });

    expect(copy).toMatchObject({ isDefault: false, body: preset?.body });
    expect((await listTemplates(db, 'agent-1')).map((row) => row.name)).toEqual(
      ['Avis de retrait', 'Avis (copie)', 'Relance'],
    );

    await deleteTemplate(db, relance, { now: NOW });

    expect((await listTemplates(db, 'agent-1')).map((row) => row.name)).toEqual(
      ['Avis de retrait', 'Avis (copie)'],
    );
    expect((await db.outbox.toArray()).at(-1)).toMatchObject({
      type: 'delete',
      entityId: relance.id,
    });
  });
});
