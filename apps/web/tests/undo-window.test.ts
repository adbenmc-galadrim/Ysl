import { describe, expect, it } from 'vitest';
import {
  canUndo,
  UNDO_WINDOW_MS,
  undoWindow,
} from '#/features/batch/undo-window';

const SINCE = 1_000_000;
const NOW = SINCE + 10_000;

const draft = (
  id: string,
  reading: 'pending' | 'read' | 'unreadable' | 'typed',
  bornAt = NOW,
) => ({
  id,
  reading,
  createdAt: new Date(bornAt),
});

describe('undoWindow', () => {
  it('stays open while the draft reads', () => {
    const window = undoWindow(null, draft('d1', 'pending'), NOW, SINCE);
    expect(canUndo(window, NOW + 60_000)).toBe(true);
  });

  it('closes 5 s after the reading landed', () => {
    const open = undoWindow(null, draft('d1', 'pending'), NOW, SINCE);
    const landed = undoWindow(open, draft('d1', 'read'), NOW + 900, SINCE);
    expect(canUndo(landed, NOW + 900 + UNDO_WINDOW_MS - 1)).toBe(true);
    expect(canUndo(landed, NOW + 900 + UNDO_WINDOW_MS)).toBe(false);
  });

  it('keeps its clock through a re-render', () => {
    const landed = undoWindow(null, draft('d1', 'read'), NOW, SINCE);
    const again = undoWindow(landed, draft('d1', 'read'), NOW + 4_000, SINCE);
    expect(again).toBe(landed);
  });

  it('restarts on a new draft, or on a number typed over an unread one', () => {
    const old = undoWindow(null, draft('d1', 'read'), NOW, SINCE);
    const fresh = undoWindow(
      old,
      draft('d2', 'read', NOW + 9_000),
      NOW + 9_000,
      SINCE,
    );
    expect(canUndo(fresh, NOW + 9_000)).toBe(true);
    const unread = undoWindow(null, draft('d3', 'unreadable'), NOW, SINCE);
    const typed = undoWindow(unread, draft('d3', 'typed'), NOW + 9_000, SINCE);
    expect(canUndo(typed, NOW + 9_000)).toBe(true);
  });

  it('offers nothing on the parcel before an undone one, render after render', () => {
    const first = undoWindow(null, draft('d1', 'read', NOW), NOW, SINCE);
    const second = undoWindow(
      first,
      draft('d2', 'read', NOW + 1_000),
      NOW + 1_000,
      SINCE,
    );
    const back = undoWindow(
      second,
      draft('d1', 'read', NOW),
      NOW + 2_000,
      SINCE,
    );
    expect(canUndo(back, NOW + 2_000)).toBe(false);
    expect(back?.newest).toBe(NOW + 1_000);
    const again = undoWindow(
      back,
      draft('d1', 'read', NOW),
      NOW + 2_100,
      SINCE,
    );
    expect(again).toBe(back);
    const third = undoWindow(
      again,
      draft('d3', 'pending', NOW + 3_000),
      NOW + 3_000,
      SINCE,
    );
    expect(canUndo(third, NOW + 3_000)).toBe(true);
  });

  it('offers nothing on a batch the screen opened on', () => {
    const picked = undoWindow(
      null,
      draft('d1', 'read', SINCE - 60_000),
      NOW,
      SINCE,
    );
    expect(canUndo(picked, NOW)).toBe(false);
    const shot = undoWindow(picked, draft('d2', 'pending', NOW), NOW, SINCE);
    expect(canUndo(shot, NOW)).toBe(true);
  });

  it('offers nothing once the batch is empty', () => {
    const old = undoWindow(null, draft('d1', 'read'), NOW, SINCE);
    expect(undoWindow(old, undefined, NOW, SINCE)).toBeNull();
    expect(canUndo(null, NOW)).toBe(false);
  });
});
