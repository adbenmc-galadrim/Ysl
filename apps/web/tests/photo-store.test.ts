import 'fake-indexeddb/auto';
import { newId } from '@repo/shared/id';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  deletePhoto,
  ORPHAN_GRACE_MS,
  savePhoto,
  sweepOrphanPhotos,
} from '#/features/photos/store';
import { NOW, openTestDatabase } from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

const photo = (id = newId()) => ({
  id,
  parcelId: null,
  kind: 'etiquette' as const,
  blob: new Blob(['etiquette'], { type: 'image/jpeg' }),
  width: 1600,
  height: 1200,
});

let db: CourrierDatabase;
let files: MemoryFiles;

beforeEach(async () => {
  db = await openTestDatabase();
  files = new MemoryFiles();
});

describe('savePhoto', () => {
  it('writes the file, then a row that describes it', async () => {
    const input = photo();
    const row = await savePhoto(db, files, input, NOW);

    expect(files.files.has(`${input.id}.jpg`)).toBe(true);
    expect(await db.photo.get(input.id)).toEqual(row);
    expect(row).toMatchObject({
      path: `photos/${input.id}.jpg`,
      bytes: 9,
      width: 1600,
      height: 1200,
      createdAt: NOW,
    });
    expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('leaves no row when the file could not be written', async () => {
    files.failNextSave = true;
    const input = photo();

    await expect(savePhoto(db, files, input)).rejects.toMatchObject({
      name: 'QuotaExceededError',
    });
    expect(await db.photo.count()).toBe(0);
  });
});

describe('deletePhoto', () => {
  it('removes the row and the file', async () => {
    const input = photo();
    await savePhoto(db, files, input);

    await deletePhoto(db, files, input.id);

    expect(await db.photo.count()).toBe(0);
    expect(files.files.size).toBe(0);
  });
});

describe('sweepOrphanPhotos', () => {
  it('removes old orphan files only', async () => {
    const kept = photo();
    await savePhoto(db, files, kept, NOW);
    files.files.get(`${kept.id}.jpg`)!.lastModified =
      NOW.getTime() - 2 * ORPHAN_GRACE_MS;
    files.files.set('old-orphan.jpg', {
      blob: new Blob(['x']),
      lastModified: NOW.getTime() - ORPHAN_GRACE_MS - 1,
    });
    files.files.set('fresh-orphan.jpg', {
      blob: new Blob(['x']),
      lastModified: NOW.getTime() - 1000,
    });

    const removed = await sweepOrphanPhotos(db, files, NOW);

    expect(removed).toEqual(['old-orphan.jpg']);
    expect([...files.files.keys()].sort()).toEqual(
      [`${kept.id}.jpg`, 'fresh-orphan.jpg'].sort(),
    );
  });
});
