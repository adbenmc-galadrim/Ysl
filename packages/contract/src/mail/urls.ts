/** Where a prepared e-mail opens (S5): the default mail app, or Outlook or Gmail by their own scheme. */
export const MAIL_TARGETS = ['mailto', 'outlook', 'gmail'] as const;

export type MailTarget = (typeof MAIL_TARGETS)[number];

/** An e-mail as the phone's mail app receives it: plain text only (RFC 6068). */
export type MailMessage = {
  to: readonly string[];
  cc?: readonly string[];
  bcc?: readonly string[];
  subject: string;
  body: string;
};

/** Addresses typed in one field, split on commas, semicolons or spaces. */
export function splitAddresses(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((address) => address.trim())
    .filter(Boolean);
}

/**
 * `encodeURIComponent`, never `URLSearchParams`: Mail shows a `+` as is (S5).
 * Every line break becomes `%0D%0A`, as RFC 6068 asks.
 */
export function encodeMailText(value: string): string {
  return encodeURIComponent(value.replace(/\r?\n/g, '\r\n'));
}

function encodeAddresses(addresses: readonly string[] = []): string {
  return addresses
    .map((address) => address.trim())
    .filter(Boolean)
    .map((address) => encodeURIComponent(address).replace(/%40/g, '@'))
    .join(',');
}

function query(params: [string, string][]): string {
  const filled = params.filter(([, value]) => value !== '');
  return filled.length === 0
    ? ''
    : `?${filled.map(([name, value]) => `${name}=${value}`).join('&')}`;
}

/** The link that opens the message, filled in, in the mail app of `target`. */
export function buildMailUrl(target: MailTarget, message: MailMessage): string {
  const to = encodeAddresses(message.to);
  const rest: [string, string][] = [
    ['cc', encodeAddresses(message.cc)],
    ['bcc', encodeAddresses(message.bcc)],
    ['subject', message.subject ? encodeMailText(message.subject) : ''],
    ['body', message.body ? encodeMailText(message.body) : ''],
  ];
  switch (target) {
    case 'mailto':
      return `mailto:${to}${query(rest)}`;
    case 'outlook':
      return `ms-outlook://compose${query([['to', to], ...rest])}`;
    case 'gmail':
      return `googlegmail:///co${query([['to', to], ...rest])}`;
  }
}
