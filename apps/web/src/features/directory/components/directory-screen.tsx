import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { AnnuaireScreen } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '#/features/db/database';
import type { LocalContact, LocalDirectoryPerson } from '#/features/db/schema';
import { contactEntries } from '#/features/directory/contacts';
import { ContactSheet } from '#/features/directory/components/contact-sheet';
import { PersonSheet } from '#/features/directory/components/person-sheet';
import {
  directoryEntries,
  directorySize,
  draftFromQuery,
} from '#/features/directory/people';

const t = createTranslator(DEFAULT_LOCALE);

const NO_PEOPLE: LocalDirectoryPerson[] = [];
const NO_CONTACTS: LocalContact[] = [];

type Editing = { person?: LocalDirectoryPerson; query?: string; key: number };

/**
 * Réglages › Annuaire: the directory built at the desk (D15, F50), and
 * under it the temps and visitors kept as contacts (F27).
 */
export function DirectoryScreen() {
  const navigate = useNavigate();
  const people = useLiveQuery(
    () => db.directoryPerson.toArray(),
    [],
    NO_PEOPLE,
  );
  const [query, setQuery] = useState('');
  const contacts = useLiveQuery(() => db.contact.toArray(), [], NO_CONTACTS);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [contact, setContact] = useState<LocalContact | null>(null);
  const size = directorySize(people);
  const open = (person?: LocalDirectoryPerson, from?: string) =>
    setEditing((previous) => ({
      person,
      query: from,
      key: (previous?.key ?? 0) + 1,
    }));

  return (
    <>
      <AnnuaireScreen
        people={directoryEntries(people, query)}
        contacts={contactEntries(contacts, query, people)}
        onSelectContact={(id) =>
          setContact(contacts.find((row) => row.id === id) ?? null)
        }
        bannerTitle={
          size === 1
            ? t('directory.banner.one')
            : t('directory.banner.many', { count: size })
        }
        bannerDetail={t('directory.banner.detail')}
        query={query}
        onQueryChange={setQuery}
        onAdd={() => open(undefined, query)}
        onSelect={(id) => open(people.find((person) => person.id === id))}
        onBack={() => void navigate({ to: '/reglages' })}
      />
      {editing && (
        <PersonSheet
          key={editing.key}
          person={editing.person}
          initial={draftFromQuery(editing.query ?? '')}
          onDone={() => setEditing(null)}
          onUseExisting={(person) => open(person)}
          onDismiss={() => setEditing(null)}
        />
      )}
      {contact && (
        <ContactSheet
          key={contact.id}
          contact={contact}
          onDone={() => setContact(null)}
          onDismiss={() => setContact(null)}
        />
      )}
    </>
  );
}
