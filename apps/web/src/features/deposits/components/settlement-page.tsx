import type { SettlementParcel } from '@repo/contract/deposits';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { SettlementContent, SettlementPanel } from '@repo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '#/features/db/database';
import { formatWhen } from '#/features/parcels/record';
import { syncNow } from '#/features/sync/sync';
import { trpcClient } from '#/lib/trpc';
import { useOnline } from '#/lib/use-online';

const t = createTranslator(DEFAULT_LOCALE);

const QUERY_KEY = ['deposits', 'settlement'];

type Choice =
  'redeposit' | 'department' | 'person' | 'return' | 'lost' | 'entrust';

/** Why this parcel is on the page, in one line. */
function causeOf(parcel: SettlementParcel): string {
  if (parcel.status === 'en_route') {
    return t('settlement.cause.carried', {
      name: parcel.carrierName ?? t('deposits.shuttle'),
    });
  }
  if (!parcel.departmentId) return t('settlement.cause.noDepartment');
  const { gap } = parcel;
  if (!gap) return t('settlement.cause.moved');
  return gap.kind === 'left'
    ? t('settlement.cause.left')
    : t('settlement.cause.count', {
        counted: gap.counted ?? 0,
        announced: gap.announced,
      });
}

/**
 * « À régulariser » (§3.7.9: the admin alone), the parcels no department can see,
 * and those of a shuttle away. Online: each decision is one transaction on the server.
 */
export function SettlementPage() {
  const online = useOnline();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => trpcClient.deposits.settlement.query(),
    enabled: online,
  });
  const people = useLiveQuery(
    () => db.directoryPerson.filter((row) => !row.deletedAt).toArray(),
    [],
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [target, setTarget] = useState('');

  const data = query.data;
  const all = data
    ? [...data.toSettle, ...data.withoutDepartment, ...data.carried]
    : [];
  const open = all.find(({ id }) => id === openId);
  const blocked = open?.status === 'a_regulariser';
  const carried = open?.status === 'en_route';

  const done = () => {
    setOpenId(null);
    setChoice(null);
    setTarget('');
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    void syncNow({ force: true });
  };
  const settle = useMutation({
    mutationFn: async () => {
      if (!open || !choice) return;
      const parcelId = open.id;
      if (choice === 'entrust') {
        await trpcClient.deposits.entrust.mutate({
          parcelIds: [parcelId],
          shuttleId: target,
        });
      } else if (choice === 'department') {
        await trpcClient.deposits.settle.mutate({
          action: 'department',
          parcelId,
          departmentId: target,
        });
      } else if (choice === 'person') {
        await trpcClient.deposits.settle.mutate({
          action: 'person',
          parcelId,
          personId: target,
        });
      } else {
        await trpcClient.deposits.settle.mutate({ action: choice, parcelId });
      }
    },
    onSuccess: done,
  });

  const departments = data?.departments ?? [];
  const nameOf = (id: string | null) =>
    departments.find((row) => row.id === id)?.name ?? t('settlement.none');
  const rows = (parcels: readonly SettlementParcel[]) => {
    const now = new Date();
    return parcels.map((parcel) => ({
      id: parcel.id,
      name: parcel.recipient ?? t('settlement.unknown'),
      department: nameOf(parcel.departmentId),
      cause: causeOf(parcel),
      since: formatWhen(parcel.since, now, t),
    }));
  };
  const select = (
    label: string,
    options: readonly { id: string; label: string }[],
  ) => ({ label, value: target, options, onChange: setTarget });
  const departmentSelect = select(
    t('settlement.select.department'),
    departments.map(({ id, name }) => ({ id, label: name })),
  );
  const personSelect = select(
    t('settlement.select.person'),
    (people ?? [])
      .filter((row) => row.departmentId)
      .map((row) => ({
        id: row.id,
        label: `${row.firstName} ${row.lastName} · ${nameOf(row.departmentId ?? null)}`,
      })),
  );
  const shuttleSelect = select(
    t('settlement.select.shuttle'),
    (data?.shuttles ?? [])
      .filter(({ id }) => id !== open?.carrierId)
      .map(({ id, name }) => ({ id, label: name })),
  );
  const forPerson = Boolean(open?.personId);
  const options = carried
    ? [
        {
          id: 'entrust',
          label: t('settlement.option.entrust'),
          select: shuttleSelect,
        },
      ]
    : [
        ...(blocked && open?.departmentId
          ? [
              {
                id: 'redeposit',
                label: t('settlement.option.redeposit', {
                  department: nameOf(open.departmentId),
                }),
              },
            ]
          : []),
        forPerson
          ? {
              id: 'person',
              label: t('settlement.option.person'),
              select: personSelect,
            }
          : {
              id: 'department',
              label: t('settlement.option.department'),
              select: departmentSelect,
            },
        ...(forPerson && !open?.departmentId
          ? [
              {
                id: 'department',
                label: t('settlement.option.department'),
                select: departmentSelect,
              },
            ]
          : []),
        ...(blocked
          ? [
              { id: 'return', label: t('settlement.option.return') },
              { id: 'lost', label: t('settlement.option.lost') },
              {
                id: 'entrust',
                label: t('settlement.option.entrust'),
                select: shuttleSelect,
              },
            ]
          : []),
      ];
  const needsTarget =
    choice === 'department' || choice === 'person' || choice === 'entrust';

  const panel = open ? (
    <SettlementPanel
      name={open.recipient ?? t('settlement.unknown')}
      line={[open.carrier, open.tracking].filter(Boolean).join(' · ')}
      banner={{
        title: causeOf(open),
        description: t('settlement.banner', {
          department: nameOf(open.departmentId),
        }),
      }}
      question={t('settlement.question')}
      options={options}
      chosen={choice ?? ''}
      onChoose={(id) => {
        setChoice(id as Choice);
        setTarget('');
      }}
      note={t('settlement.note', {
        name: open.carrierName ?? t('deposits.shuttle'),
      })}
      error={settle.isError ? settle.error.message : undefined}
      actionLabel={t('settlement.action')}
      disabled={
        !online || settle.isPending || !choice || (needsTarget && !target)
      }
      onAction={() => settle.mutate()}
      onClose={() => setOpenId(null)}
    />
  ) : undefined;

  const waiting = data?.toSettle.length ?? 0;
  return (
    <div className="px-5 pt-[calc(var(--safe-top)+12px)] pb-10 xl:p-0">
      <SettlementContent
        title={t('settlement.title')}
        subtitle={
          !online
            ? t('settlement.offline')
            : waiting === 1
              ? t('settlement.subtitle.one')
              : t('settlement.subtitle.many', { count: waiting })
        }
        sections={[
          {
            id: 'toSettle',
            title: t('settlement.section.toSettle'),
            rows: rows(data?.toSettle ?? []),
          },
          {
            id: 'withoutDepartment',
            title: t('settlement.section.withoutDepartment'),
            rows: rows(data?.withoutDepartment ?? []),
          },
          {
            id: 'carried',
            title: t('settlement.section.carried'),
            rows: rows(data?.carried ?? []),
          },
        ]}
        columns={{
          name: t('settlement.column.name'),
          department: t('settlement.column.department'),
          cause: t('settlement.column.cause'),
          since: t('settlement.column.since'),
        }}
        empty={online ? t('settlement.empty') : t('settlement.offline')}
        activeRow={openId ?? undefined}
        onRow={(id) => {
          setOpenId(id);
          setChoice(null);
          setTarget('');
          settle.reset();
        }}
        panel={panel}
      />
      {data?.extras.length ? (
        <section className="mt-6">
          <h2 className="mb-2 text-14 font-semibold">
            {t('settlement.section.extras')}
          </h2>
          <ul className="text-13 text-ink-2">
            {data.extras.map((row) => (
              <li key={row.id}>
                {t('settlement.extra', {
                  department: nameOf(row.departmentId),
                  counted: row.counted,
                  announced: row.announced,
                  when: formatWhen(row.confirmedAt, new Date(), t),
                })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
