import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import type { FixAddressSheetProps } from '@repo/ui';
import { useEffect, useState } from 'react';
import { db } from '#/features/db/database';
import {
  cardEditable,
  checkAddress,
  type AddressCard,
  type AddressCheck,
} from '#/features/mail/fix-address';

const t = createTranslator(DEFAULT_LOCALE);

export type AddressEntry = {
  /** The typed address once usable, normalised; null while it is not. */
  address: string | null;
  onCard: boolean;
  /** The field and the box of `FixAddressSheet`, checked at each keystroke. */
  fields: (
    failed: boolean,
  ) => Pick<
    FixAddressSheetProps,
    | 'value'
    | 'onValueChange'
    | 'valid'
    | 'error'
    | 'updateDirectory'
    | 'onUpdateDirectoryChange'
    | 'updateLabel'
    | 'updateDisabled'
    | 'updateHelp'
  >;
};

/**
 * The address typed for a card, checked as it is typed: well formed, and
 * not another card's when it goes on the card (`checkAddress`). `card` is
 * null while it loads: nothing is said yet.
 */
export function useAddressEntry(
  card: AddressCard | null,
  initial: string,
): AddressEntry {
  const [value, setValue] = useState(initial);
  const [onCard, setOnCard] = useState(true);
  const [check, setCheck] = useState<AddressCheck | null>(null);

  useEffect(() => {
    if (!card) return;
    let live = true;
    void checkAddress(db, card, value, onCard).then((next) => {
      if (live) setCheck(next);
    });
    return () => {
      live = false;
    };
  }, [card, value, onCard]);

  const editable = !card || cardEditable(card);
  return {
    address: check?.kind === 'ok' ? check.address : null,
    onCard: onCard && editable,
    fields: (failed) => ({
      value,
      onValueChange: setValue,
      valid: check?.kind === 'ok',
      error: failed
        ? t('notify.error')
        : check?.kind === 'invalid' && value.trim()
          ? t('mails.fix.invalid')
          : check?.kind === 'duplicate'
            ? t('mails.fix.duplicate', { name: check.name })
            : undefined,
      updateDirectory: onCard,
      onUpdateDirectoryChange: setOnCard,
      updateLabel:
        card?.kind === 'contact'
          ? t('mails.fix.onContact')
          : t('mails.fix.onDirectory'),
      updateDisabled: !editable,
      updateHelp: editable ? undefined : t('mails.fix.companyCard'),
    }),
  };
}
