import {
  DIRECTORY_CSV_MAX_LENGTH,
  type DepartmentChoice,
  type DirectoryColumn,
  type DirectoryImportPreview,
  type DirectoryImportProblem,
} from '@repo/contract/directory';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  type CompanyShellNavSection,
  ImportCsvDesktop,
  type ImportErrorRow,
} from '@repo/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import type { LocalDepartment } from '#/features/db/schema';
import { useCompanyName } from '#/features/directory/components/use-company-name';
import { initialsOf } from '#/features/settings/initials';
import { syncNow } from '#/features/sync/sync';
import { trpcClient } from '#/lib/trpc';
import { useOnline } from '#/lib/use-online';

const t = createTranslator(DEFAULT_LOCALE);

const COLUMN_LABELS: Record<DirectoryColumn, string> = {
  lastName: t('directory.import.column.lastName'),
  firstName: t('directory.import.column.firstName'),
  email: t('directory.import.column.email'),
  department: t('directory.import.column.department'),
  site: t('directory.import.column.site'),
};

const PROBLEMS: Record<DirectoryImportProblem, string> = {
  'name-missing': t('directory.import.problem.name'),
  'email-invalid': t('directory.import.problem.email'),
  'duplicate-in-file': t('directory.import.problem.duplicate'),
  'department-unknown': t('directory.import.problem.department'),
};

const NAV: CompanyShellNavSection[] = [
  {
    items: [
      { id: 'annuaire', label: t('directory.nav.directory'), icon: 'users' },
    ],
  },
];

const SHOWN_ERRORS = 8;

function errorRows(preview: DirectoryImportPreview): ImportErrorRow[] {
  return preview.errors.slice(0, SHOWN_ERRORS).map((row) => ({
    line: String(row.line),
    name: row.name,
    email: row.email,
    emailBad: row.problem === 'email-invalid',
    department: row.department,
    departmentBad: row.problem === 'department-unknown',
    problem: PROBLEMS[row.problem],
    tone: row.problem === 'department-unknown' ? 'orange' : 'red',
  }));
}

/**
 * The CSV of the DSI (F50): read by the server against the directory, shown,
 * and applied only once the admin has seen what it does. A department the file
 * names and the company lacks is created or replaced here, one at a time.
 */
export function DirectoryImport({
  file,
  departments,
  onChangeFile,
  onClose,
}: {
  file: File;
  departments: readonly LocalDepartment[];
  onChangeFile: () => void;
  onClose: () => void;
}) {
  const session = useSession();
  const online = useOnline();
  const [csv, setCsv] = useState<string | null>(null);
  const [choices, setChoices] = useState<DepartmentChoice[]>([]);
  const [created, setCreated] = useState<{ id: string; name: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    let current = true;
    if (file.size > DIRECTORY_CSV_MAX_LENGTH) {
      setMessage(t('directory.import.tooBig'));
      return;
    }
    void file
      .text()
      .then((text) => {
        if (!current) return;
        if (!text.trim()) setMessage(t('directory.import.empty'));
        else setCsv(text);
      })
      .catch(() => {
        if (current) setMessage(t('directory.import.read'));
      });
    return () => {
      current = false;
    };
  }, [file]);

  // A mutation only for its size: the file does not fit a GET. It writes nothing.
  const preview = useQuery({
    queryKey: [
      'directory',
      'previewImport',
      file.name,
      file.lastModified,
      choices,
    ],
    enabled: csv !== null,
    gcTime: 0,
    placeholderData: (previous) => previous,
    queryFn: () =>
      trpcClient.directory.previewImport.mutate({ csv: csv ?? '', choices }),
  });
  const name = useCompanyName();

  const data = preview.data;
  const unknown = data?.unknownDepartments[0];
  const toImport = (data?.toAdd ?? 0) + (data?.toUpdate ?? 0);
  const ignored = data?.errors.length ?? 0;
  const missing = data?.missing.length ? data.missing : null;

  const choose = (departmentId: string) => {
    if (unknown) {
      setChoices((previous) => [
        ...previous,
        { name: unknown.name, departmentId },
      ]);
    }
  };

  const create = async () => {
    if (!unknown || creating) return;
    setCreating(true);
    setMessage(undefined);
    try {
      const department = await trpcClient.departments.create.mutate({
        name: unknown.name,
      });
      setCreated((previous) => [...previous, department]);
      void syncNow({ force: true });
      choose(department.id);
    } catch {
      setMessage(t('directory.import.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const submit = async () => {
    if (!csv || submitting) return;
    setSubmitting(true);
    setMessage(undefined);
    try {
      await trpcClient.directory.applyImport.mutate({ csv, choices });
      await syncNow({ force: true });
      onClose();
    } catch {
      setMessage(t('directory.import.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const options = [
    ...departments.map((row) => ({ id: row.id, label: row.name })),
    ...created
      .filter((row) => !departments.some((known) => known.id === row.id))
      .map((row) => ({ id: row.id, label: row.name })),
  ];
  const offline = !online ? t('directory.import.offline') : undefined;
  const failed = preview.isError ? t('directory.import.failed') : undefined;
  const absent = missing
    ? t('directory.import.missing', {
        columns: missing.map((column) => COLUMN_LABELS[column]).join(', '),
      })
    : undefined;

  return (
    <ImportCsvDesktop
      company={{
        name,
        subtitle: t('auth.role.admin'),
        initials: initialsOf(name),
      }}
      nav={NAV}
      account={{
        initials: initialsOf(session.user.name),
        name: session.user.name,
        role: t('auth.role.admin'),
      }}
      onNavigate={onClose}
      companyCrumb={name}
      subtitle={
        data
          ? t('directory.import.subtitle', {
              file: file.name,
              lines: data.lines,
              separator: data.separator,
            })
          : file.name
      }
      columns={(data?.columns ?? []).map(({ source, target }) => ({
        source,
        target: COLUMN_LABELS[target],
      }))}
      figures={[
        { label: t('directory.import.toAdd'), value: String(data?.toAdd ?? 0) },
        {
          label: t('directory.import.toUpdate'),
          value: String(data?.toUpdate ?? 0),
        },
        {
          label: t('directory.import.unchanged'),
          value: String(data?.unchanged ?? 0),
        },
        {
          label: t('directory.import.errors'),
          value: String(ignored),
          red: ignored > 0,
        },
      ]}
      errors={data ? errorRows(data) : []}
      unknown={
        unknown && {
          name: unknown.name,
          lines: unknown.lines,
          departments: options,
          onChoose: choose,
          onCreate: () => void create(),
          creating,
        }
      }
      summary={t('directory.import.summary', {
        people:
          toImport === 1
            ? t('directory.import.summary.one')
            : t('directory.import.summary.many', { count: toImport }),
        ignored:
          ignored === 1
            ? t('directory.import.ignored.one')
            : t('directory.import.ignored.many', { count: ignored }),
      })}
      submitLabel={
        toImport === 1
          ? t('directory.import.submit.one')
          : t('directory.import.submit.many', { count: toImport })
      }
      canSubmit={online && !!data && !missing && toImport > 0}
      submitting={submitting}
      message={message ?? absent ?? offline ?? failed}
      onChangeFile={onChangeFile}
      onCancel={onClose}
      onSubmit={() => void submit()}
    />
  );
}
