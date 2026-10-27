import { describe, expect, it } from 'vitest';
import {
  linkMailer,
  OPEN_WINDOW_MS,
  type PageWatch,
} from '#/features/mail/mailer';

function fakePage(hidden = false) {
  let hide: (() => void) | undefined;
  let tick: (() => void) | undefined;
  let waited = 0;
  const page: PageWatch = {
    hidden: () => hidden,
    onHide: (listener) => {
      hide = listener;
      return () => (hide = undefined);
    },
    wait: (ms, then) => {
      waited = ms;
      tick = then;
      return () => (tick = undefined);
    },
  };
  return {
    page,
    hide: () => hide?.(),
    elapse: () => tick?.(),
    waited: () => waited,
  };
}

const message = {
  to: ['nora@example.com'],
  subject: 'Colis',
  body: 'Bonjour\nNora',
};

describe('linkMailer', () => {
  it('prepares the link of its target and says how long it is', () => {
    const prepared = linkMailer('outlook').prepare(message);
    expect(prepared).toEqual({
      target: 'outlook',
      url: 'ms-outlook://compose?to=nora@example.com&subject=Colis&body=Bonjour%0D%0ANora',
      length: prepared.url.length,
    });
  });

  it('reads the page going to the background within 2 s as the mail app opening', async () => {
    const mailer = linkMailer('mailto');
    const fake = fakePage();
    const outcome = mailer.open(mailer.prepare(message), fake.page);
    fake.hide();
    fake.elapse();
    await expect(outcome).resolves.toBe('opened');
    expect(fake.waited()).toBe(OPEN_WINDOW_MS);
  });

  it('says the page stayed when nothing moved in time', async () => {
    const mailer = linkMailer('gmail');
    const fake = fakePage();
    const outcome = mailer.open(mailer.prepare(message), fake.page);
    fake.elapse();
    fake.hide();
    await expect(outcome).resolves.toBe('stayed');
  });
});
