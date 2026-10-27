import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it, vi } from 'vitest';
import {
  copyText,
  mailText,
  needsFallback,
  notOpenedReason,
  otherTargets,
  shareMail,
} from '#/features/mail/fallback';
import {
  DEFAULT_MAIL_TARGET,
  MAIL_TARGET_KEY,
  readMailTarget,
  writeMailTarget,
} from '#/features/mail/mail-target';
import {
  linkMailer,
  watchOpening,
  type PageWatch,
} from '#/features/mail/mailer';

const t = createTranslator(DEFAULT_LOCALE);

function memoryStorage(initial?: string) {
  const items = new Map<string, string>();
  if (initial !== undefined) items.set(MAIL_TARGET_KEY, initial);
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

const message = {
  to: ['nora@example.com'],
  subject: 'Des colis vous attendent',
  body: 'Bonjour Nora,\n\n• Amazon ···4471',
};

describe('the mail app chosen on this iPhone', () => {
  it('is Mail until the agent picks another', () => {
    expect(readMailTarget(memoryStorage())).toBe('mailto');
    expect(DEFAULT_MAIL_TARGET).toBe('mailto');
  });

  it('comes back as saved', () => {
    const storage = memoryStorage();
    writeMailTarget('gmail', storage);
    expect(readMailTarget(storage)).toBe('gmail');
  });

  it.each(['thunderbird', '"outlook"', ''])(
    'reads a value it does not know as Mail: %s',
    (saved) => {
      expect(readMailTarget(memoryStorage(saved))).toBe('mailto');
    },
  );

  it.each([
    ['mailto', 'mailto:nora@example.com?'],
    ['outlook', 'ms-outlook://compose?to=nora@example.com&'],
    ['gmail', 'googlegmail:///co?to=nora@example.com&'],
  ] as const)('opens %s by its own link', (target, start) => {
    const storage = memoryStorage();
    writeMailTarget(target, storage);
    const prepared = linkMailer(readMailTarget(storage)).prepare(message);
    expect(prepared.url.startsWith(start)).toBe(true);
  });
});

describe('the fallback when the mail app did not open', () => {
  it('shows when the page never went to the background', async () => {
    let tick: (() => void) | undefined;
    const page: PageWatch = {
      hidden: () => false,
      onHide: () => () => {},
      wait: (_ms, then) => {
        tick = then;
        return () => {};
      },
    };
    const outcome = watchOpening(page);
    tick?.();
    expect(needsFallback(await outcome)).toBe(true);
    expect(needsFallback('opened')).toBe(false);
  });

  it('offers the two other mail apps', () => {
    expect(otherTargets('mailto')).toEqual(['outlook', 'gmail']);
    expect(otherTargets('gmail')).toEqual(['mailto', 'outlook']);
  });

  it('copies the subject and body, then the address on its own', async () => {
    const clipboard = {
      writeText: vi.fn<(text: string) => Promise<void>>(() =>
        Promise.resolve(),
      ),
    };
    expect(await copyText(mailText(message), clipboard)).toBe(true);
    expect(await copyText(message.to[0]!, clipboard)).toBe(true);
    expect(clipboard.writeText.mock.calls).toEqual([
      ['Des colis vous attendent\n\nBonjour Nora,\n\n• Amazon ···4471'],
      ['nora@example.com'],
    ]);
  });

  it('says so when the clipboard is refused or missing', async () => {
    const refused = {
      writeText: () =>
        Promise.reject(new DOMException('denied', 'NotAllowedError')),
    };
    expect(await copyText('x', refused)).toBe(false);
    expect(await copyText('x', null)).toBe(false);
  });

  it('shares the subject as title and the whole text', async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>(() =>
      Promise.resolve(),
    );
    expect(await shareMail(message, { share })).toBe('shared');
    expect(share).toHaveBeenCalledWith({
      title: 'Des colis vous attendent',
      text: 'Des colis vous attendent\n\nBonjour Nora,\n\n• Amazon ···4471',
    });
  });

  it('reads a closed share sheet as cancelled, not as a failure', async () => {
    const share = () =>
      Promise.reject(new DOMException('closed', 'AbortError'));
    expect(await shareMail(message, { share })).toBe('cancelled');
  });

  it('tells a missing share sheet from one refused for an expired tap', async () => {
    expect(await shareMail(message, {})).toBe('unavailable');
    const refused = () =>
      Promise.reject(new DOMException('no gesture', 'NotAllowedError'));
    expect(await shareMail(message, { share: refused })).toBe('blocked');
  });

  it('gives up with the name of the mail app that did not open', () => {
    expect(notOpenedReason('outlook', t)).toBe(
      'Outlook ne s’est pas ouvert, e-mail abandonné',
    );
  });
});
