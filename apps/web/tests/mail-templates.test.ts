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
  setDefaultTemplate,
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
    expect(templates.map((row) => [row.type, row.stored])).toEqual([
      ['avis', true],
      ['relance', false],
    ]);
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
    const relance = await createTemplate(db, 'Colis volumineux', options);
    const copy = await duplicateTemplate(db, preset!, 'Avis (copie)', options);
    await createTemplate(db, 'Le sien', { ...options, userId: 'agent-2' });

    expect(copy).toMatchObject({ isDefault: false, body: preset?.body });
    expect((await listTemplates(db, 'agent-1')).map((row) => row.name)).toEqual(
      ['Avis de retrait', 'Avis (copie)', 'Colis volumineux', 'Relance'],
    );

    await deleteTemplate(db, relance, { now: NOW });

    expect((await listTemplates(db, 'agent-1')).map((row) => row.name)).toEqual(
      ['Avis de retrait', 'Avis (copie)', 'Relance'],
    );
    expect((await db.outbox.toArray()).at(-1)).toMatchObject({
      type: 'delete',
      entityId: relance.id,
    });
  });

  it('makes another template the default, the former one written first and kept', async () => {
    const relance = await createTemplate(db, 'Colis volumineux', options);

    const chosen = await setDefaultTemplate(db, relance, options);

    expect(chosen).toMatchObject({ id: relance.id, isDefault: true });
    const templates = await listTemplates(db, 'agent-1');
    expect(
      templates.map((row) => [row.name, row.isDefault, row.preset]),
    ).toEqual([
      ['Colis volumineux', true, false],
      ['Avis de retrait', false, true],
      ['Relance', true, true],
    ]);
    const ops = (await db.outbox.toArray()).slice(-2);
    expect(ops.map((op) => [op.entityId, op.patch.isDefault])).toEqual([
      [await presetTemplateId('agent-1', 'avis'), false],
      [relance.id, true],
    ]);
  });

  it('never deletes the default one nor the preset, which comes back as default', async () => {
    const relance = await createTemplate(db, 'Colis volumineux', options);
    const chosen = await setDefaultTemplate(db, relance, options);
    const preset = (await listTemplates(db, 'agent-1')).find(
      (row) => row.preset,
    )!;

    await expect(deleteTemplate(db, chosen)).rejects.toBeInstanceOf(
      DefaultTemplateError,
    );
    await expect(deleteTemplate(db, preset)).rejects.toBeInstanceOf(
      DefaultTemplateError,
    );
    await setDefaultTemplate(db, preset, options);
    await deleteTemplate(db, { ...chosen, isDefault: false });

    expect(await listTemplates(db, 'agent-1')).toEqual([
      expect.objectContaining({ type: 'avis', preset: true, isDefault: true }),
      expect.objectContaining({
        type: 'relance',
        preset: true,
        isDefault: true,
      }),
    ]);
  });

  it('offers the reminder template, default of its own type', async () => {
    const templates = await listTemplates(db, 'agent-1');
    const reminder = templates.find((row) => row.type === 'relance');
    expect(reminder).toMatchObject({
      ...DEFAULT_TEMPLATES.relance,
      id: await presetTemplateId('agent-1', 'relance'),
      isDefault: true,
      preset: true,
    });
    const copy = await duplicateTemplate(db, reminder!, 'Relance courte', {
      ...options,
    });
    await setDefaultTemplate(db, copy, options);
    const after = await listTemplates(db, 'agent-1');
    expect(after.map((row) => [row.name, row.type, row.isDefault])).toEqual([
      ['Avis de retrait', 'avis', true],
      ['Relance courte', 'relance', true],
      ['Relance', 'relance', false],
    ]);
  });

  it('restores only the preset', async () => {
    const relance = await createTemplate(db, 'Colis volumineux', options);
    const restored = await restoreDefault(
      db,
      { ...relance, body: 'Changé' },
      options,
    );
    expect(restored.body).toBe('Changé');
  });
});
