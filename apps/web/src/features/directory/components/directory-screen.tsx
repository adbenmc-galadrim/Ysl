import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  AnnuaireDesktop,
  AnnuaireMobile,
  type AnnuairePerson,
  type CompanyShellNavSection,
  ContactRow,
  MoveSheetMobile,
  PersonFormMobile,
  PersonFormPanel,
  PersonRecordPanel,
  SectionHeader,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  type ChangeEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import type {
  LocalContact,
  LocalDepartment,
  LocalDirectoryPerson,
  LocalParcel,
} from '#/features/db/schema';
import { contactEntries } from '#/features/directory/contacts';
import { ContactSheet } from '#/features/directory/components/contact-sheet';
import { DirectoryImport } from '#/features/directory/components/directory-import';
import { useCompanyName } from '#/features/directory/components/use-company-name';
import { usePersonForm } from '#/features/directory/components/person-form';
import { useMove } from '#/features/directory/components/use-move';
import {
  ALL_DEPARTMENTS,
  departmentLabel,
  directoryPeople,
  draftFromQuery,
  fullName,
  letterOf,
  listed,
  moveEffectLines,
  NO_DEPARTMENT,
  openParcelsByPerson,
} from '#/features/directory/people';
import { initialsOf } from '#/features/settings/initials';
import { useMediaQuery } from '#/lib/use-media-query';

const t = createTranslator(DEFAULT_LOCALE);

const NO_PEOPLE: LocalDirectoryPerson[] = [];
const NO_CONTACTS: LocalContact[] = [];
const NO_DEPARTMENTS: LocalDepartment[] = [];
const NO_PARCELS: LocalParcel[] = [];
const PAGE = 50;
const DESK_WIDTH = '(min-width: 1280px)';
const CONTACTS_TAB = 'contacts';

const DESK_NAV: CompanyShellNavSection[] = [
  {
    items: [
      { id: 'colis', label: t('directory.nav.parcels'), icon: 'package' },
      { id: 'annuaire', label: t('directory.nav.directory'), icon: 'users' },
      { id: 'reglages', label: t('directory.nav.settings'), icon: 'sliders' },
    ],
  },
];

type Open =
  | { kind: 'add'; key: number; query?: string }
  | { kind: 'record'; id: string }
  | { kind: 'edit'; id: string }
  | null;

const peopleWord = (count: number) =>
  count === 1
    ? t('directory.people.one')
    : t('directory.people.many', { count });

function useDirectory() {
  const people = useLiveQuery(
    () => db.directoryPerson.toArray(),
    [],
    NO_PEOPLE,
  );
  const contacts = useLiveQuery(() => db.contact.toArray(), [], NO_CONTACTS);
  const departments = useLiveQuery(
    () =>
      db.department
        .orderBy('name')
        .filter((row) => !row.deletedAt)
        .toArray(),
    [],
    NO_DEPARTMENTS,
  );
  const parcels = useLiveQuery(() => db.parcel.toArray(), [], NO_PARCELS);
  const names = useMemo(
    () => new Map(departments.map((row) => [row.id, row.name])),
    [departments],
  );
  const open = useMemo(() => openParcelsByPerson(parcels), [parcels]);
  return { people, contacts, departments, parcels, names, open };
}

type Directory = ReturnType<typeof useDirectory>;

const departmentOptions = (
  departments: readonly LocalDepartment[],
  withNone: boolean,
) => [
  ...(withNone ? [{ id: '', label: t('directory.noDepartment') }] : []),
  ...departments.map((row) => ({ id: row.id, label: row.name })),
];

function dateOf(date: Date | null | undefined): string {
  if (!date) return t('directory.record.never');
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function recordDetails(person: LocalDirectoryPerson, directory: Directory) {
  const last = directory.parcels
    .filter((row) => row.personId === person.id && row.deliveredAt)
    .map((row) => row.deliveredAt as Date)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return [
    { label: t('directory.record.place'), value: person.site ?? '—' },
    {
      label: t('directory.record.open'),
      value: String(directory.open.get(person.id) ?? 0),
    },
    { label: t('directory.record.added'), value: dateOf(person.createdAt) },
    { label: t('directory.record.lastPickup'), value: dateOf(last) },
  ];
}

function DeskForm({
  person,
  query,
  directory,
  onDone,
  onShow,
  onCancel,
}: {
  person?: LocalDirectoryPerson;
  query?: string;
  directory: Directory;
  onDone: (person: LocalDirectoryPerson) => void;
  onShow: (person: LocalDirectoryPerson) => void;
  onCancel: () => void;
}) {
  const form = usePersonForm({
    person,
    initial: draftFromQuery(query ?? ''),
    names: directory.names,
    onDone,
  });
  const { duplicate } = form;
  return (
    <PersonFormPanel
      title={person ? t('directory.edit.title') : t('directory.add.title')}
      submitLabel={
        person ? t('directory.edit.submit') : t('directory.add.submit')
      }
      value={form.value}
      onChange={form.onChange}
      errors={form.errors}
      saving={form.saving}
      message={form.message}
      departments={
        person ? undefined : departmentOptions(directory.departments, true)
      }
      conflict={
        duplicate && {
          title: form.conflictTitle,
          description: fullName(duplicate),
          action: {
            label: t('directory.duplicate.show'),
            onClick: () => onShow(duplicate),
          },
        }
      }
      onSubmit={form.onSubmit}
      onCancel={onCancel}
    />
  );
}

function DeskRecord({
  person,
  directory,
  onEdit,
  onClose,
}: {
  person: LocalDirectoryPerson;
  directory: Directory;
  onEdit: () => void;
  onClose: () => void;
}) {
  const move = useMove(person);
  const name = fullName(person);
  const targetName = directory.names.get(move.target) ?? '';
  const effects =
    move.chosen && move.effects
      ? moveEffectLines(
          move.effects,
          targetName,
          departmentLabel(person, directory.names),
        )
      : move.chosen
        ? []
        : undefined;
  return (
    <PersonRecordPanel
      key={person.id}
      name={name}
      email={person.email}
      initials={initialsOf(name)}
      departments={departmentOptions(
        directory.departments,
        !person.departmentId,
      )}
      target={move.target}
      onTarget={move.setTarget}
      effects={effects}
      details={recordDetails(person, directory)}
      moving={move.moving}
      canMove={move.canMove}
      message={move.message}
      onMove={() => void move.move()}
      onCancelMove={move.reset}
      onEdit={onEdit}
      onClose={onClose}
    />
  );
}

function DirectoryDesktop({
  directory,
  onImport,
}: {
  directory: Directory;
  onImport: () => void;
}) {
  const navigate = useNavigate();
  const session = useSession();
  const { people, contacts, departments, names, open } = directory;
  const company = useCompanyName();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState(ALL_DEPARTMENTS);
  const [page, setPage] = useState(0);
  const [panel, setPanel] = useState<Open>(null);
  const [contact, setContact] = useState<LocalContact | null>(null);

  const listedPeople = people.filter(listed);
  const inContacts = tab === CONTACTS_TAB;
  const found = inContacts ? [] : directoryPeople(people, names, query, tab);
  const contactRows = inContacts ? contactEntries(contacts, query, people) : [];
  const total = inContacts ? contactRows.length : found.length;
  const lastPage = Math.max(0, Math.ceil(total / PAGE) - 1);
  const shownPage = Math.min(page, lastPage);
  const from = shownPage * PAGE;
  const rows: AnnuairePerson[] = inContacts
    ? contactRows.slice(from, from + PAGE).map((row) => ({
        id: row.id,
        name: row.name,
        email: row.detail ?? '',
        department: t('directory.contacts.title'),
        place: '',
        open: 0,
      }))
    : found.slice(from, from + PAGE).map((person) => ({
        id: person.id,
        name: fullName(person),
        email: person.email,
        department: departmentLabel(person, names),
        place: person.site ?? '',
        open: open.get(person.id) ?? 0,
      }));
  const count = (id: string | null) =>
    listedPeople.filter((person) => (person.departmentId ?? null) === id)
      .length;
  const withoutDepartment = count(null);
  const tabs = [
    {
      id: ALL_DEPARTMENTS,
      label: t('directory.tab.all', { count: listedPeople.length }),
    },
    ...departments.map((row) => ({
      id: row.id,
      label: `${row.name} ${count(row.id)}`,
    })),
    ...(withoutDepartment
      ? [
          {
            id: NO_DEPARTMENT,
            label: t('directory.tab.none', { count: withoutDepartment }),
          },
        ]
      : []),
    ...(contacts.some((row) => !row.deletedAt)
      ? [
          {
            id: CONTACTS_TAB,
            label: t('directory.tab.contacts', {
              count: contacts.filter((row) => !row.deletedAt).length,
            }),
          },
        ]
      : []),
  ];
  const selected =
    panel && panel.kind !== 'add'
      ? people.find((person) => person.id === panel.id)
      : undefined;
  const select = (id: string) => {
    if (inContacts) {
      setContact(contacts.find((row) => row.id === id) ?? null);
    } else {
      setPanel({ kind: 'record', id });
    }
  };

  let side: ReactNode = null;
  if (panel?.kind === 'add' || panel?.kind === 'edit') {
    side = (
      <DeskForm
        key={panel.kind === 'add' ? `add-${panel.key}` : panel.id}
        person={selected}
        query={panel.kind === 'add' ? panel.query : undefined}
        directory={directory}
        onDone={(person) => setPanel({ kind: 'record', id: person.id })}
        onShow={(person) => setPanel({ kind: 'record', id: person.id })}
        onCancel={() =>
          setPanel(selected ? { kind: 'record', id: selected.id } : null)
        }
      />
    );
  } else if (panel?.kind === 'record' && selected) {
    side = (
      <DeskRecord
        key={selected.id}
        person={selected}
        directory={directory}
        onEdit={() => setPanel({ kind: 'edit', id: selected.id })}
        onClose={() => setPanel(null)}
      />
    );
  }

  return (
    <>
      <AnnuaireDesktop
        company={{
          name: company,
          subtitle: t('auth.role.admin'),
          initials: initialsOf(company),
        }}
        nav={DESK_NAV}
        account={{
          initials: initialsOf(session.user.name),
          name: session.user.name,
          role: t('auth.role.admin'),
        }}
        companyCrumb={company}
        onNavigate={(id) => {
          if (id === 'colis') void navigate({ to: '/' });
          if (id === 'reglages') void navigate({ to: '/reglages' });
        }}
        search={{
          value: query,
          onChange: (value) => {
            setQuery(value);
            setPage(0);
          },
        }}
        variant="company"
        title={t('directory.title')}
        subtitle={
          departments.length === 1
            ? t('directory.subtitle.one', {
                people: peopleWord(listedPeople.length),
              })
            : t('directory.subtitle.many', {
                people: peopleWord(listedPeople.length),
                count: departments.length,
              })
        }
        tabs={tabs}
        activeTab={tab}
        onTab={(id) => {
          setTab(id);
          setPage(0);
          setPanel(null);
        }}
        people={rows}
        activePerson={selected?.id}
        onSelect={select}
        range={t('directory.range', {
          from: total ? from + 1 : 0,
          to: Math.min(from + PAGE, total),
          total,
        })}
        onPrevious={() => setPage(Math.max(0, shownPage - 1))}
        onNext={() => setPage(Math.min(lastPage, shownPage + 1))}
        onAdd={() =>
          setPanel((previous) => ({
            kind: 'add',
            key: previous?.kind === 'add' ? previous.key + 1 : 0,
            query: total === 0 ? query : undefined,
          }))
        }
        onImport={onImport}
        panel={side}
      />
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

function MobileForm({
  person,
  query,
  directory,
  onDone,
  onShow,
  onMove,
  onClose,
}: {
  person?: LocalDirectoryPerson;
  query?: string;
  directory: Directory;
  onDone: () => void;
  onShow: (person: LocalDirectoryPerson) => void;
  onMove?: () => void;
  onClose: () => void;
}) {
  const form = usePersonForm({
    person,
    initial: draftFromQuery(query ?? ''),
    names: directory.names,
    onDone,
  });
  const { duplicate } = form;
  return (
    <PersonFormMobile
      title={person ? fullName(person) : t('directory.add.titleMobile')}
      submitLabel={
        person ? t('directory.edit.submit') : t('directory.add.submit')
      }
      value={form.value}
      onChange={form.onChange}
      errors={form.errors}
      saving={form.saving}
      message={form.message}
      departments={
        person ? undefined : departmentOptions(directory.departments, true)
      }
      conflict={
        duplicate && {
          title: form.conflictTitle,
          description: fullName(duplicate),
          action: t('directory.duplicate.show'),
          onAction: () => onShow(duplicate),
        }
      }
      footerAction={
        onMove && {
          label: t('directory.move.action'),
          onClick: onMove,
        }
      }
      onSubmit={form.onSubmit}
      onClose={onClose}
    />
  );
}

function MobileMove({
  person,
  directory,
  onDone,
  onDismiss,
}: {
  person: LocalDirectoryPerson;
  directory: Directory;
  onDone: () => void;
  onDismiss: () => void;
}) {
  const move = useMove(person);
  const name = directory.names.get(move.target);
  const effect =
    move.chosen && move.effects
      ? moveEffectLines(
          move.effects,
          name ?? '',
          departmentLabel(person, directory.names),
        )
      : null;
  return (
    <MoveSheetMobile
      fixed
      behind={<span />}
      name={fullName(person)}
      departments={departmentOptions(directory.departments, false)}
      currentId={person.departmentId ?? null}
      targetId={move.target || null}
      onTarget={move.setTarget}
      effect={
        effect && {
          title: effect[0]?.text ?? '',
          description: effect[1]?.text ?? '',
        }
      }
      submitLabel={
        name && move.chosen
          ? t('directory.move.submit', { department: name })
          : t('directory.move.action')
      }
      canSubmit={move.canMove}
      message={move.message}
      onSubmit={() =>
        void move.move().then((moved) => {
          if (moved) onDone();
        })
      }
      onDismiss={onDismiss}
    />
  );
}

function DirectoryPhone({ directory }: { directory: Directory }) {
  const navigate = useNavigate();
  const { people, contacts, departments, names } = directory;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(t('directory.filter.all'));
  const [editing, setEditing] = useState<Open>(null);
  const [moving, setMoving] = useState(false);
  const [contact, setContact] = useState<LocalContact | null>(null);

  const tabId =
    departments.find((row) => row.name === filter)?.id ?? ALL_DEPARTMENTS;
  const found = directoryPeople(people, names, query, tabId);
  const groups = new Map<string, typeof found>();
  for (const person of found) {
    const letter = letterOf(fullName(person));
    groups.set(letter, [...(groups.get(letter) ?? []), person]);
  }
  const outside = contactEntries(contacts, query, people);
  const selected =
    editing && editing.kind !== 'add'
      ? people.find((person) => person.id === editing.id)
      : undefined;

  if (editing) {
    return (
      <>
        <MobileForm
          key={editing.kind === 'add' ? `add-${editing.key}` : editing.id}
          person={selected}
          query={editing.kind === 'add' ? editing.query : undefined}
          directory={directory}
          onDone={() => setEditing(null)}
          onShow={(person) => setEditing({ kind: 'edit', id: person.id })}
          onMove={
            selected && departments.length ? () => setMoving(true) : undefined
          }
          onClose={() => setEditing(null)}
        />
        {moving && selected && (
          <MobileMove
            person={selected}
            directory={directory}
            onDone={() => setMoving(false)}
            onDismiss={() => setMoving(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <AnnuaireMobile
        title={t('directory.title')}
        searchPlaceholder={t('directory.search')}
        filter={
          departments.length
            ? {
                options: [
                  t('directory.filter.all'),
                  ...departments.map((row) => row.name),
                ],
                value: filter,
                onChange: setFilter,
              }
            : undefined
        }
        groups={[...groups].map(([letter, group]) => ({
          letter,
          people: group.map((person) => ({
            id: person.id,
            name: fullName(person),
            initials: initialsOf(fullName(person)),
            detail: departmentLabel(person, names) || person.email,
          })),
        }))}
        query={query}
        onQueryChange={setQuery}
        onSelect={(id) => setEditing({ kind: 'edit', id })}
        onAdd={() =>
          setEditing({
            kind: 'add',
            key: Date.now(),
            query: found.length ? undefined : query,
          })
        }
        onBack={() => void navigate({ to: '/reglages' })}
        emptyTitle={
          outside.length
            ? undefined
            : query.trim()
              ? t('directory.empty.search', { query: query.trim() })
              : t('directory.empty.title')
        }
        emptyDescription={
          query.trim() ? undefined : t('directory.empty.description')
        }
        footer={
          outside.length > 0 && (
            <section
              aria-label={t('directory.contacts.title')}
              className="mt-6 pb-6"
            >
              <SectionHeader
                title={t('directory.contacts.title')}
                count={outside.length}
              />
              <p className="mt-1 text-13 text-muted">
                {t('directory.contacts.detail')}
              </p>
              <div className="mt-3">
                {outside.map((row, i) => (
                  <ContactRow
                    key={row.id}
                    name={row.name}
                    initials={row.initials}
                    detail={row.detail}
                    separator={i < outside.length - 1}
                    onClick={() =>
                      setContact(
                        contacts.find((known) => known.id === row.id) ?? null,
                      )
                    }
                  />
                ))}
              </div>
            </section>
          )
        }
      />
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

/**
 * Réglages › Annuaire: the whole company's directory for its admin (D15
 * révisée, ME21), a table beside a record on a computer and a list on the
 * phone (D23). The temps and visitors kept as contacts (F27) stay under it.
 */
export function DirectoryScreen() {
  const directory = useDirectory();
  const desk = useMediaQuery(DESK_WIDTH);
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    event.target.value = '';
  };

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        aria-hidden="true"
        tabIndex={-1}
        className="hidden"
        onChange={onFile}
      />
      {file && desk ? (
        <DirectoryImport
          key={`${file.name}-${file.lastModified}`}
          file={file}
          departments={directory.departments}
          onChangeFile={() => fileInput.current?.click()}
          onClose={() => setFile(null)}
        />
      ) : desk ? (
        <DirectoryDesktop
          directory={directory}
          onImport={() => fileInput.current?.click()}
        />
      ) : (
        <DirectoryPhone directory={directory} />
      )}
    </>
  );
}
