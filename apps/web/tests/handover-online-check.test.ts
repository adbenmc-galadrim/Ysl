import 'fake-indexeddb/auto';
import { newPickupToken, type PickupVerifyOutput } from '@repo/contract/pickup';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  lookupPickupPin,
  lookupPickupText,
  type OnlineCheck,
} from '#/features/handover/pickup-lookup';
import { NOW, openTestDatabase, pickupCodeRow } from './helpers/local-rows';

const LATER = new Date(NOW.getTime() + 60_000);

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

function server(
  answer: Partial<PickupVerifyOutput> | (() => Promise<never>),
  { online = true, sync = (): Promise<unknown> => Promise.resolve() } = {},
) {
  const verify = vi.fn(() =>
    typeof answer === 'function'
      ? answer()
      : Promise.resolve({
          status: 'unknown' as const,
          codeId: null,
          recipient: null,
          ...answer,
        }),
  );
  const check: OnlineCheck = {
    online: () => online,
    verify,
    sync: vi.fn(sync),
    waitMs: 20,
  };
  return { check, verify };
}

describe('the server at the desk', () => {
  it('is not asked offline, nor for a refusal this iPhone is sure of', async () => {
    const token = newPickupToken();
    await db.pickupCode.put(
      await pickupCodeRow({ personId: 'nora', usedAt: NOW }, { token }),
    );
    const offline = server({ status: 'active' }, { online: false });
    const online = server({ status: 'active' });

    expect(
      (await lookupPickupPin(db, '1111', LATER, offline.check)).status,
    ).toBe('unknown');
    expect(
      (await lookupPickupText(db, token, LATER, online.check)).status,
    ).toBe('used');
    expect(offline.verify).not.toHaveBeenCalled();
    expect(online.verify).not.toHaveBeenCalled();
  });

  it('pulls a code a colleague has just issued, then opens it here', async () => {
    const token = newPickupToken();
    const code = await pickupCodeRow({ personId: 'nora' }, { token });
    const { check } = server(
      { status: 'active', codeId: code.id },
      { sync: () => db.pickupCode.put(code) },
    );

    expect(await lookupPickupText(db, token, LATER, check)).toEqual({
      status: 'active',
      code,
    });
  });

  it('says which counter a code of another department opens', async () => {
    const elsewhere = {
      department: 'Finance',
      location: 'Bâtiment B',
      name: 'Léa Fontaine',
    };
    const { check, verify } = server({
      status: 'other_department',
      elsewhere,
    });

    expect(await lookupPickupPin(db, '4821', LATER, check)).toEqual({
      status: 'other_department',
      elsewhere,
    });
    expect(verify).toHaveBeenCalledWith(
      expect.objectContaining({ elsewhere: true }),
    );
  });

  it('lets the server close a copy left here by a move to another department', async () => {
    const token = newPickupToken();
    const code = await pickupCodeRow({ personId: 'nora' }, { token });
    await db.pickupCode.put(code);
    const { check } = server({
      status: 'other_department',
      codeId: code.id,
      elsewhere: { department: 'Finance', location: null, name: null },
    });

    const match = await lookupPickupText(db, token, LATER, check);

    expect(match.status).toBe('other_department');
  });

  it('says why the server refuses a code this iPhone does not know', async () => {
    const { check } = server({ status: 'replaced' });

    expect((await lookupPickupPin(db, '4821', LATER, check)).status).toBe(
      'replaced',
    );
  });

  it('refuses a code used on another iPhone since the last pull', async () => {
    const code = await pickupCodeRow({ personId: 'nora' });
    await db.pickupCode.put(code);
    const { check } = server({ status: 'used', codeId: code.id });
    const other = server({ status: 'used', codeId: 'another code' });

    expect((await lookupPickupPin(db, '4821', LATER, check)).status).toBe(
      'used',
    );
    expect(check.sync).toHaveBeenCalled();
    expect((await lookupPickupPin(db, '4821', LATER, other.check)).status).toBe(
      'active',
    );
  });

  it('keeps the verdict of this iPhone when the server fails or is slow', async () => {
    const code = await pickupCodeRow({ personId: 'nora' });
    await db.pickupCode.put(code);
    const failing = server(() => Promise.reject(new Error('fetch failed')));
    const slow = server(() => new Promise<never>(() => undefined));

    expect(
      (await lookupPickupPin(db, '4821', LATER, failing.check)).status,
    ).toBe('active');
    expect((await lookupPickupPin(db, '4821', LATER, slow.check)).status).toBe(
      'active',
    );
    expect((await lookupPickupPin(db, '9999', LATER, slow.check)).status).toBe(
      'unknown',
    );
    expect(
      (await lookupPickupText(db, newPickupToken(), LATER, slow.check)).status,
    ).toBe('unknown');
  });
});
