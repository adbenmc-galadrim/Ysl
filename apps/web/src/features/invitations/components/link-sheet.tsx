import type { LinkDelivery } from '@repo/contract/accounts';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Button, FieldInput, Sheet } from '@repo/ui';
import { useState } from 'react';

const t = createTranslator(DEFAULT_LOCALE);

const longDate = (date: Date) =>
  date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/** What became of a link: sent, or to hand over from here, the only time it is shown. */
export function LinkSheet({
  delivery,
  named,
  onClose,
  onCopyInstead,
}: {
  delivery: LinkDelivery;
  /** Left out for the app's admin, whose screen names nobody once the mail is gone (D26). */
  named?: { name: string; email: string };
  onClose: () => void;
  /** A new link to copy, for a mail that does not arrive. */
  onCopyInstead?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const date = longDate(delivery.expiresAt);
  if (delivery.delivery === 'sent') {
    return (
      <Sheet
        fixed
        title={t('accounts.link.sent.title')}
        description={
          named
            ? t('accounts.link.sent.description', { ...named, date })
            : t('accounts.link.sent.descriptionAnonymous', { date })
        }
        className="pb-[calc(var(--safe-bottom)+16px)]"
        onDismiss={onClose}
      >
        <Button block className="mt-6" onClick={onClose}>
          {t('accounts.link.close')}
        </Button>
        {onCopyInstead && (
          <Button
            variant="secondary"
            block
            className="mt-3"
            onClick={onCopyInstead}
          >
            {t('accounts.link.sent.notArrived')}
          </Button>
        )}
      </Sheet>
    );
  }
  return (
    <Sheet
      fixed
      title={
        named
          ? t('accounts.link.copy.title', { name: named.name })
          : t('accounts.link.copy.titleAnonymous')
      }
      description={t(`accounts.link.copy.${delivery.reason}`)}
      className="pb-[calc(var(--safe-bottom)+16px)]"
      onDismiss={onClose}
    >
      <FieldInput
        id="account-link"
        readOnly
        aria-label={t('accounts.link.line')}
        value={delivery.link}
        className="mt-4"
        onFocus={(event) => event.target.select()}
      />
      <p className="mt-2 text-13 text-muted">
        {t('accounts.link.copy.note', { date })}
      </p>
      <Button
        block
        className="mt-6"
        onClick={() => {
          void navigator.clipboard.writeText(delivery.link).then(() => {
            setCopied(true);
          });
        }}
      >
        {copied ? t('accounts.link.copy.done') : t('accounts.link.copy.action')}
      </Button>
      <Button variant="secondary" block className="mt-3" onClick={onClose}>
        {t('accounts.link.close')}
      </Button>
    </Sheet>
  );
}
