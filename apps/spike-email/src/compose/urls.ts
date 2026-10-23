export type Draft = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
};

export type Target = 'mailto' | 'outlook' | 'gmail';

export const TARGETS: readonly { target: Target; label: string }[] = [
  { target: 'mailto', label: 'Mail (mailto)' },
  { target: 'outlook', label: 'Outlook' },
  { target: 'gmail', label: 'Gmail' },
];

export function splitAddresses(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((address) => address.trim())
    .filter(Boolean);
}

export function encodeText(value: string): string {
  return encodeURIComponent(value.replace(/\r?\n/g, '\r\n'));
}

function encodeAddresses(value: string): string {
  return splitAddresses(value)
    .map((address) => encodeURIComponent(address).replace(/%40/g, '@'))
    .join(',');
}

function query(params: [string, string][]): string {
  const filled = params.filter(([, value]) => value !== '');
  return filled.length === 0
    ? ''
    : `?${filled.map(([name, value]) => `${name}=${value}`).join('&')}`;
}

export function buildUrl(target: Target, draft: Draft): string {
  const to = encodeAddresses(draft.to);
  const rest: [string, string][] = [
    ['cc', encodeAddresses(draft.cc)],
    ['bcc', encodeAddresses(draft.bcc)],
    ['subject', draft.subject ? encodeText(draft.subject) : ''],
    ['body', draft.body ? encodeText(draft.body) : ''],
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
