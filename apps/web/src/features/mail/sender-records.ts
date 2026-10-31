import type { DnsRecord } from '@repo/contract/mail';
import type { createTranslator } from '@repo/shared/i18n';

type Translate = ReturnType<typeof createTranslator>;

export function recordLine(record: DnsRecord, t: Translate): string {
  return t('sender.record.line', {
    label: t(`sender.record.${record.kind}`),
    type: record.type,
    host: record.host,
  });
}

/** What the admin forwards to the client's IT, in one paste. */
export function recordsText(records: DnsRecord[], t: Translate): string {
  return records
    .map((record) => `${recordLine(record, t)}\n${record.value}`)
    .join('\n\n');
}
