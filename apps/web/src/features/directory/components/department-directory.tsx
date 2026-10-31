import { MOVE_REQUEST_NOTE_MAX } from '@repo/contract/directory';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  AnnuaireDesktop,
  AnnuaireMobile,
  MoveRequestPanel,
  MoveRequestSheetMobile,
  PersonFormMobile,
  PersonFormPanel,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import type { LocalDirectoryPerson } from '#/features/db/schema';
import { usePersonForm } from '#/features/directory/components/person-form';
import {
  type Directory,
  useDirectory,
} from '#/features/directory/components/use-directory';
import { useMoveRequests } from '#/features/directory/components/use-move-requests';
import {
  directoryPeople,
  draftFromQuery,
  fullName,
  letterOf,
  listed,
} from '#/features/directory/people';
import { initialsOf } from '#/features/settings/initials';
import { useDeskShell } from '#/features/shell/components/use-desk-shell';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';

const t = createTranslator(DEFAULT_LOCALE);

const PAGE = 50;

type Open =
  | { kind: 'add'; key: number; query?: string }
  | { kind: 'edit'; id: string }
  | { kind: 'request'; id: string }
  | null;

const dayOf = (date: Date) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);

/** The account's own department: the only one the synchro brings it. */
function useOwnDepartment(directory: Directory) {
  const own = directory.departments[0];
  return { id: own?.id ?? '', name: own?.name ?? '' };
}

function useForm({
  person,
  query,
  directory,
  onDone,
}: {
  person?: LocalDirectoryPerson;
  query?: string;
  directory: Directory;
  onDone: () => void;
}) {
  const own = useOwnDepartment(directory);
  return usePersonForm({
    person,
    initial: { ...draftFromQuery(query ?? ''), departmentId: own.id },
    names: directory.names,
    onDone,
  });
}

/** The state of the request form, whichever draws it. */
function useRequestForm(person: LocalDirectoryPerson, onDone: () => void) {
  const { online, byPerson, ask, close } = useMoveRequests();
  const open = byPerson.get(person.id);
  const [note, setNote] = useState<string>();
  const failed = ask.isError || close.isError;
  return {
    name: fullName(person),
    sent: open
      ? t('directory.request.sent', { date: dayOf(open.createdAt) })
      : undefined,
    note: note ?? open?.note ?? '',
    onNote: (text: string) => setNote(text.slice(0, MOVE_REQUEST_NOTE_MAX)),
    saving: ask.isPending || close.isPending,
    message: !online
      ? t('directory.request.offline')
      : failed
        ? t('directory.request.failed')
        : undefined,
    onSubmit: () => {
      if (!online) return;
      ask.mutate(
        { personId: person.id, note: note ?? open?.note ?? '' },
        { onSuccess: onDone },
      );
    },
    onWithdraw: () => {
      if (!online) return;
      close.mutate(person.id, { onSuccess: onDone });
    },
    onCancel: onDone,
  };
}

function DeskRequest({
  person,
  onDone,
}: {
  person: LocalDirectoryPerson;
  onDone: () => void;
}) {
  return <MoveRequestPanel {...useRequestForm(person, onDone)} />;
}

function PhoneRequest({
  person,
  onDone,
}: {
  person: LocalDirectoryPerson;
  onDone: () => void;
}) {
  return <MoveRequestSheetMobile {...useRequestForm(person, onDone)} />;
}

function DeskForm({
  person,
  query,
  directory,
  onShow,
  onRequest,
  onClose,
}: {
  person?: LocalDirectoryPerson;
  query?: string;
  directory: Directory;
  onShow: (person: LocalDirectoryPerson) => void;
  onRequest: () => void;
  onClose: () => void;
}) {
  const form = useForm({ person, query, directory, onDone: onClose });
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
      conflict={
        duplicate && {
          title: t('directory.duplicate.title'),
          description: fullName(duplicate),
          action: {
            label: t('directory.duplicate.show'),
            onClick: () => onShow(duplicate),
          },
        }
      }
      footerAction={
        person && {
          label: t('directory.request.action'),
          onClick: onRequest,
        }
      }
      onSubmit={form.onSubmit}
      onCancel={onClose}
    />
  );
}

function Desk({ directory }: { directory: Directory }) {
  const shell = useDeskShell();
  const own = useOwnDepartment(directory);
  const { people, names, open } = directory;
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [panel, setPanel] = useState<Open>(null);

  const total = people.filter(listed).length;
  const found = directoryPeople(people, names, query);
  const lastPage = Math.max(0, Math.ceil(found.length / PAGE) - 1);
  const shownPage = Math.min(page, lastPage);
  const from = shownPage * PAGE;
  const selected =
    panel && panel.kind !== 'add'
      ? people.find((person) => person.id === panel.id)
      : undefined;

  return (
    <AnnuaireDesktop
      {...shell}
      search={{
        value: query,
        onChange: (value) => {
          setQuery(value);
          setPage(0);
        },
      }}
      variant="department"
      title={
        own.name
          ? t('directory.department.title', { department: own.name })
          : t('directory.title')
      }
      subtitle={t('directory.department.subtitle', {
        people:
          total === 1
            ? t('directory.people.one')
            : t('directory.people.many', { count: total }),
      })}
      people={found.slice(from, from + PAGE).map((person) => ({
        id: person.id,
        name: fullName(person),
        email: person.email,
        place: person.site ?? '',
        open: open.get(person.id) ?? 0,
      }))}
      activePerson={selected?.id}
      onSelect={(id) => setPanel({ kind: 'edit', id })}
      range={t('directory.range', {
        from: found.length ? from + 1 : 0,
        to: Math.min(from + PAGE, found.length),
        total: found.length,
      })}
      onPrevious={() => setPage(Math.max(0, shownPage - 1))}
      onNext={() => setPage(Math.min(lastPage, shownPage + 1))}
      onAdd={() =>
        setPanel((previous) => ({
          kind: 'add',
          key: previous?.kind === 'add' ? previous.key + 1 : 0,
          query: found.length === 0 ? query : undefined,
        }))
      }
      panel={
        panel?.kind === 'request' && selected ? (
          <DeskRequest
            key={selected.id}
            person={selected}
            onDone={() => setPanel({ kind: 'edit', id: selected.id })}
          />
        ) : panel?.kind === 'add' || (panel?.kind === 'edit' && selected) ? (
          <DeskForm
            key={panel.kind === 'add' ? `add-${panel.key}` : panel.id}
            person={selected}
            query={panel.kind === 'add' ? panel.query : undefined}
            directory={directory}
            onShow={(person) => setPanel({ kind: 'edit', id: person.id })}
            onRequest={() =>
              selected && setPanel({ kind: 'request', id: selected.id })
            }
            onClose={() => setPanel(null)}
          />
        ) : null
      }
    />
  );
}

function PhoneForm({
  person,
  query,
  directory,
  onShow,
  onRequest,
  onClose,
}: {
  person?: LocalDirectoryPerson;
  query?: string;
  directory: Directory;
  onShow: (person: LocalDirectoryPerson) => void;
  onRequest: () => void;
  onClose: () => void;
}) {
  const own = useOwnDepartment(directory);
  const form = useForm({ person, query, directory, onDone: onClose });
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
      note={
        !person && own.name
          ? t('directory.add.note', { department: own.name })
          : undefined
      }
      conflict={
        duplicate && {
          title: t('directory.duplicate.title'),
          description: fullName(duplicate),
          action: t('directory.duplicate.show'),
          onAction: () => onShow(duplicate),
        }
      }
      footerAction={
        person && {
          label: t('directory.request.action'),
          onClick: onRequest,
        }
      }
      onSubmit={form.onSubmit}
      onClose={onClose}
    />
  );
}

function Phone({ directory }: { directory: Directory }) {
  const navigate = useNavigate();
  const own = useOwnDepartment(directory);
  const { people, names } = directory;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Open>(null);

  const found = directoryPeople(people, names, query);
  const groups = new Map<string, typeof found>();
  for (const person of found) {
    const letter = letterOf(fullName(person));
    groups.set(letter, [...(groups.get(letter) ?? []), person]);
  }
  const selected =
    open && open.kind !== 'add'
      ? people.find((person) => person.id === open.id)
      : undefined;

  // A card that left the department while open must not become a new one.
  if (open && (open.kind === 'add' || selected)) {
    return (
      <>
        <PhoneForm
          key={open.kind === 'add' ? `add-${open.key}` : open.id}
          person={selected}
          query={open.kind === 'add' ? open.query : undefined}
          directory={directory}
          onShow={(person) => setOpen({ kind: 'edit', id: person.id })}
          onRequest={() =>
            selected && setOpen({ kind: 'request', id: selected.id })
          }
          onClose={() => setOpen(null)}
        />
        {open.kind === 'request' && selected && (
          <PhoneRequest
            person={selected}
            onDone={() => setOpen({ kind: 'edit', id: selected.id })}
          />
        )}
      </>
    );
  }

  return (
    <AnnuaireMobile
      title={
        own.name
          ? t('directory.department.title', { department: own.name })
          : t('directory.title')
      }
      searchPlaceholder={t('directory.department.search')}
      groups={[...groups].map(([letter, group]) => ({
        letter,
        people: group.map((person) => ({
          id: person.id,
          name: fullName(person),
          initials: initialsOf(fullName(person)),
          detail: person.site ?? person.email,
        })),
      }))}
      query={query}
      onQueryChange={setQuery}
      onSelect={(id) => setOpen({ kind: 'edit', id })}
      onAdd={() =>
        setOpen({
          kind: 'add',
          key: Date.now(),
          query: found.length ? undefined : query,
        })
      }
      onBack={() => void navigate({ to: '/' })}
      emptyTitle={
        query.trim()
          ? t('directory.empty.search', { query: query.trim() })
          : t('directory.empty.title')
      }
      emptyDescription={
        query.trim() ? undefined : t('directory.department.empty')
      }
    />
  );
}

/** A department's own people (ME22), added and edited like the admin's, moved only by the admin. */
export function DepartmentDirectory() {
  const directory = useDirectory();
  const desk = useMediaQuery(DESK_WIDTH);
  return desk ? <Desk directory={directory} /> : <Phone directory={directory} />;
}
