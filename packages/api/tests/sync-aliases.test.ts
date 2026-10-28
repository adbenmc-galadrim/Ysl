import type { AnyDb } from '@repo/db';
import type { PGlite } from '@electric-sql/pglite';
import type { PullOutput, SyncOp } from '@repo/contract/sync';
import { newId } from '@repo/shared/id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pull } from '#features/sync/pull';
import { push } from '#features/sync/push';
import {
  AGENT_ID,
  asAnyDb,
  openTestDb,
  ORGANIZATION_ID,
  type TestDb,
} from './helpers/pglite';

const READER = { organizationId: ORGANIZATION_ID, userId: AGENT_ID };

let client: PGlite;
let db: TestDb;
let sync: AnyDb;

const writer = {
  organizationId: ORGANIZATION_ID,
  userId: AGENT_ID,
  role: 'agent',
} as const;
const NOW = new Date('2026-10-27T09:30:00Z');

beforeAll(async () => {
  ({ client, db } = await openTestDb());
  sync = asAnyDb(db);
});

afterAll(async () => {
  await client.close();
});

const stamps = { createdAt: NOW, updatedAt: NOW, deletedAt: null };

function op(entity: SyncOp['entity'], patch: { id: string }): SyncOp {
  return {
    opId: newId(),
    entity,
    entityId: patch.id,
    type: 'upsert',
    patch,
    clientTs: NOW,
  };
}

async function pullAll(): Promise<PullOutput['rows']> {
  const rows: PullOutput['rows'] = [];
  let page = await pull(sync, READER, {
    cursor: null,
    page: null,
    limit: 100,
  });
  rows.push(...page.rows);
  while (page.next) {
    page = await pull(sync, READER, {
      cursor: null,
      page: page.next,
      limit: 100,
    });
    rows.push(...page.rows);
  }
  return rows;
}

describe('learned aliases across devices (§4.8)', () => {
  it('pushes what iPhone A learned, and iPhone B pulls it', async () => {
    const sender = {
      id: newId(),
      ...stamps,
      displayName: 'Atelier Rive Gauche',
      nameNorm: 'atelier rive gauche',
      seenCount: 1,
    };
    const senderAlias = {
      id: newId(),
      ...stamps,
      aliasNorm: 'ateller rive gavche',
      senderId: sender.id,
      confirmations: 1,
    };
    const contact = {
      id: newId(),
      ...stamps,
      name: 'Léa Fontaine',
      nameNorm: 'lea fontaine',
    };
    const recipientAlias = {
      id: newId(),
      ...stamps,
      nameNorm: 'dji europe bv',
      personId: null,
      contactId: contact.id,
      confirmations: 2,
    };

    const { results } = await push(sync, writer, {
      ops: [
        op('sender', sender),
        op('sender_alias', senderAlias),
        op('contact', contact),
        op('recipient_alias', recipientAlias),
      ],
    });
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);

    const rows = await pullAll();
    const pulled = (entity: string) =>
      rows.filter((r) => r.entity === entity).map((r) => r.row);
    expect(pulled('sender_alias')).toEqual([
      expect.objectContaining({
        id: senderAlias.id,
        aliasNorm: 'ateller rive gavche',
        senderId: sender.id,
        confirmations: 1,
      }),
    ]);
    expect(pulled('recipient_alias')).toEqual([
      expect.objectContaining({
        id: recipientAlias.id,
        nameNorm: 'dji europe bv',
        contactId: contact.id,
        personId: null,
        confirmations: 2,
      }),
    ]);
  });

  it('refuses an alias pointing at nobody, or at two cards', async () => {
    const both = {
      id: newId(),
      ...stamps,
      nameNorm: 'personne',
      personId: newId(),
      contactId: newId(),
    };
    const none = { id: newId(), ...stamps, nameNorm: 'personne' };

    const { results } = await push(sync, writer, {
      ops: [op('recipient_alias', both), op('recipient_alias', none)],
    });

    expect(results.map((r) => r.status >= 400 && r.status < 500)).toEqual([
      true,
      true,
    ]);
  });

  it('keeps an account’s challenger through the sync', async () => {
    const owner = {
      id: newId(),
      ...stamps,
      displayName: 'Maison Duval',
      nameNorm: 'maison duval',
    };
    const challenger = {
      id: newId(),
      ...stamps,
      displayName: 'Duval Logistique',
      nameNorm: 'duval logistique',
    };
    const account = {
      id: newId(),
      ...stamps,
      carrier: 'ups',
      accountNumber: 'E6344W',
      senderId: owner.id,
      confirmations: 3,
      challengerId: challenger.id,
      challenges: 1,
    };

    const { results } = await push(sync, writer, {
      ops: [
        op('sender', owner),
        op('sender', challenger),
        op('sender_account', account),
      ],
    });
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);

    const rows = await pullAll();
    expect(rows.find((r) => r.row.id === account.id)?.row).toMatchObject({
      challengerId: challenger.id,
      challenges: 1,
    });
  });
});
