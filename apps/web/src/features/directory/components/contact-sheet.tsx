import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { normalizeName } from '@repo/shared/text';
import {
  Button,
  HorsAnnuaireSheet,
  type OutsideContactDraft,
  Sheet,
} from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import type { LocalContact } from '#/features/db/schema';
import {
  contactDraft,
  deleteContact,
  mergeContact,
  mergeTarget,
  saveContact,
} from '#/features/directory/contacts';
import { fullName, normalizeEmail, toEntry } from '#/features/directory/people';

const t = createTranslator(DEFAULT_LOCALE);

export type ContactSheetProps = {
  contact: LocalContact;
  /** From « Sans e-mail »: the sheet asks for the address, the field focused. */
  addingEmail?: boolean;
  /** Saved, merged or deleted. */
  onDone: () => void;
  onDismiss: () => void;
};

/**
 * A contact outside the directory, edited wherever it shows: Réglages ›
 * Annuaire, the parcel's record. Its name, e-mail and department; when the
 * directory now lists the same human, « Rattacher à … » moves its parcels
 * and learned names there; « Supprimer » takes it off the lists.
 */
export function ContactSheet({
  contact,
  addingEmail = false,
  onDone,
  onDismiss,
}: ContactSheetProps) {
  const agentId = useSession().user.id;
  const people = useLiveQuery(() => db.directoryPerson.toArray(), []);
  const [draft, setDraft] = useState<OutsideContactDraft>(() =>
    contactDraft(contact),
  );
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const busy = useRef(false);
  const target = people
    ? mergeTarget(
        {
          email: normalizeEmail(draft.email) || null,
          nameNorm: normalizeName(draft.name),
        },
        people,
      )
    : null;

  const run = async (write: () => Promise<boolean>) => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setFailed(false);
    try {
      if (await write()) onDone();
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const save = () =>
    run(async () => {
      const result = await saveContact(db, contact.id, draft);
      if (result.kind === 'invalid') {
        setError(
          result.field === 'email' ? t('edit.error.emailInvalid') : null,
        );
        return false;
      }
      if (result.kind === 'duplicate') {
        setError(t('contact.duplicate', { name: result.contact.name }));
        return false;
      }
      return true;
    });

  if (deleting) {
    return (
      <Sheet
        fixed
        title={t('contact.delete.title', { name: contact.name })}
        description={
          failed ? t('contact.error.write') : t('contact.delete.description')
        }
        className="pb-[calc(var(--safe-bottom)+16px)]"
        onDismiss={() => setDeleting(false)}
      >
        <Button
          variant="destructive"
          block
          disabled={saving}
          className="mt-6"
          onClick={() =>
            void run(async () => {
              await deleteContact(db, contact.id);
              return true;
            })
          }
        >
          {t('contact.delete.confirm')}
        </Button>
        <Button
          variant="secondary"
          block
          className="mt-3"
          onClick={() => setDeleting(false)}
        >
          {t('record.cancel')}
        </Button>
      </Sheet>
    );
  }

  return (
    <HorsAnnuaireSheet
      fixed
      title={addingEmail ? t('contact.edit.addEmail') : t('contact.edit.title')}
      description={
        failed
          ? t('contact.error.write')
          : addingEmail
            ? t('contact.edit.addEmail.description')
            : t('contact.edit.description')
      }
      submitLabel={t('contact.edit.save')}
      value={draft}
      onChange={(next) => {
        setError(null);
        setFailed(false);
        setDraft(next);
      }}
      emailError={error ?? undefined}
      focusEmail={addingEmail}
      merge={
        target && {
          ...toEntry(target),
          label: t('contact.merge', { name: fullName(target) }),
          onMerge: () =>
            void run(async () => {
              await mergeContact(db, contact.id, target.id, { agentId });
              return true;
            }),
        }
      }
      saving={saving}
      onSubmit={() => void save()}
      onDelete={addingEmail ? undefined : () => setDeleting(true)}
      onDismiss={onDismiss}
    />
  );
}
