import {
  buildMailUrl,
  type MailMessage,
  type MailTarget,
} from '@repo/contract/mail';

/** A message ready to leave: the link to put on the `<a href>` and how long it is. */
export type PreparedMail = { target: MailTarget; url: string; length: number };

/**
 * `opened`: the page went to the background soon after the tap, so the mail
 * app most likely took over. `stayed`: nothing moved — app missing, link
 * refused, or just slow (Gmail missed the 2 s in S5). Neither proves a mail.
 */
export type OpenOutcome = 'opened' | 'stayed';

/** What `open` watches: the page's visibility, and a clock. */
export type PageWatch = {
  hidden: () => boolean;
  onHide: (listener: () => void) => () => void;
  wait: (ms: number, then: () => void) => () => void;
};

/**
 * How a mail leaves the app. Today, the phone's own mail app, from the
 * agent's own address (D2, S5); a Microsoft Graph sender (D20) would
 * implement the same two steps without leaving the app.
 */
export type Mailer = {
  readonly target: MailTarget;
  prepare: (message: MailMessage) => PreparedMail;
  /**
   * To call from the tap on a real `<a href={prepared.url}>`: iOS opens a
   * mail app only from a user's gesture on a link, never from script.
   */
  open: (prepared: PreparedMail, page?: PageWatch) => Promise<OpenOutcome>;
};

/** How long the page has to go to the background after the tap (S5). */
export const OPEN_WINDOW_MS = 2_000;

export const browserPage: PageWatch = {
  hidden: () => document.visibilityState === 'hidden',
  onHide: (listener) => {
    const onChange = () => {
      if (document.visibilityState === 'hidden') listener();
    };
    document.addEventListener('visibilitychange', onChange);
    window.addEventListener('pagehide', listener);
    return () => {
      document.removeEventListener('visibilitychange', onChange);
      window.removeEventListener('pagehide', listener);
    };
  },
  wait: (ms, then) => {
    const timer = window.setTimeout(then, ms);
    return () => window.clearTimeout(timer);
  },
};

export function watchOpening(
  page: PageWatch,
  windowMs = OPEN_WINDOW_MS,
): Promise<OpenOutcome> {
  return new Promise((resolve) => {
    if (page.hidden()) {
      resolve('opened');
      return;
    }
    let stopHide = () => {};
    let stopWait = () => {};
    const settle = (outcome: OpenOutcome) => {
      stopHide();
      stopWait();
      resolve(outcome);
    };
    stopHide = page.onHide(() => settle('opened'));
    stopWait = page.wait(windowMs, () => settle('stayed'));
  });
}

/** The mail app of `target`, reached by its link. */
export function linkMailer(target: MailTarget): Mailer {
  return {
    target,
    prepare: (message) => {
      const url = buildMailUrl(target, message);
      return { target, url, length: url.length };
    },
    open: (_prepared, page = browserPage) => watchOpening(page),
  };
}

export const MAILERS: Record<MailTarget, Mailer> = {
  mailto: linkMailer('mailto'),
  outlook: linkMailer('outlook'),
  gmail: linkMailer('gmail'),
};
