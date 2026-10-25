import { afterEach, describe, expect, it, vi } from 'vitest';
import { lockPage, scrollsInside, type ScrollBox } from '#lib/page-lock';

type Box = ScrollBox & { overflow: string };

const box = (
  overflow: string,
  scrollHeight: number,
  clientHeight: number,
  parentElement: Box | null = null,
): Box => ({ overflow, scrollHeight, clientHeight, parentElement });

const overflowOf = (b: ScrollBox) => (b as Box).overflow;

describe('scrollsInside', () => {
  it('refuses a move that could only drag the page', () => {
    const page = box('visible', 900, 844);
    const scene = box('hidden', 844, 844, page);
    expect(scrollsInside(box('visible', 40, 40, scene), overflowOf)).toBe(
      false,
    );
    expect(scrollsInside(null, overflowOf)).toBe(false);
  });

  it('lets a box taller than its frame scroll, from any child', () => {
    const sheet = box('auto', 720, 600);
    expect(scrollsInside(box('visible', 54, 54, sheet), overflowOf)).toBe(true);
  });

  it('keeps a scrolling box that fits frozen: nothing to scroll there', () => {
    const sheet = box('auto', 520, 520);
    expect(scrollsInside(box('visible', 54, 54, sheet), overflowOf)).toBe(
      false,
    );
  });
});

describe('lockPage', () => {
  const page = () => {
    const listeners = new Map<string, unknown>();
    const html = { style: { overflow: 'scroll', overscrollBehavior: 'auto' } };
    const body = { style: { overflow: '', overscrollBehavior: '' } };
    vi.stubGlobal('document', {
      documentElement: html,
      body,
      addEventListener: (type: string, listener: unknown) =>
        listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
    });
    return { html, body, listeners };
  };

  afterEach(() => vi.unstubAllGlobals());

  it('keeps the page frozen until the last of nested locks lets go', () => {
    const { html, body, listeners } = page();
    const scan = lockPage();
    const sheet = lockPage();
    expect(html.style.overflow).toBe('hidden');
    expect(body.style.overscrollBehavior).toBe('none');
    sheet();
    sheet();
    expect(html.style.overflow).toBe('hidden');
    expect(listeners.has('touchmove')).toBe(true);
    scan();
    expect(html.style).toEqual({
      overflow: 'scroll',
      overscrollBehavior: 'auto',
    });
    expect(body.style).toEqual({ overflow: '', overscrollBehavior: '' });
    expect(listeners.size).toBe(0);
  });
});
