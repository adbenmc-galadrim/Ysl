import { DEPOSIT_GAPS, type DepositGap } from '@repo/contract/deposits';
import { confirmsEachParcel } from '@repo/contract/operating-profile';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { DepartmentDepositMobile, DepositDoneScreen } from '@repo/ui';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '#/features/db/database';
import {
  depositMailRows,
  loadDepositMails,
} from '#/features/mail/deposit-mails';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';
import { gapLine, isPending } from '#/features/parcels/deposit';
import {
  carrierLineOf,
  describeParcel,
  formatTime,
} from '#/features/parcels/model';
import { parcelsLabel } from '#/features/parcels/tour-view';
import { useOperatingProfile } from '#/features/settings/operating-profile';
import { useOwnDepartmentName } from '#/features/shell/components/use-desk-shell';
import { syncNow } from '#/features/sync/sync';
import { trpcClient } from '#/lib/trpc';
import { useOnline } from '#/lib/use-online';

const t = createTranslator(DEFAULT_LOCALE);

/** The kind a count suggests; the department can always say otherwise. */
const kindOf = (counted: number, announced: number): DepositGap =>
  counted > announced ? 'extra' : 'missing';

/** Written on the server in one transaction (D24): the word of the department is not queued. */
export function DepartmentDepositPage({ depositId }: { depositId: string }) {
  const navigate = useNavigate();
  const online = useOnline();
  const name = useOwnDepartmentName();
  const data = useLiveQuery(async () => {
    const deposit = await db.deposit.get(depositId);
    if (!deposit) return { deposit: undefined, parcels: [], mails: undefined };
    const rows = (await db.parcel.bulkGet(deposit.parcelIds)).filter(
      (row) => row !== undefined,
    );
    const context = await loadRecipientContext(db, rows);
    const now = new Date();
    return {
      deposit,
      mails: await loadDepositMails(db, deposit.parcelIds),
      parcels: rows.flatMap((row) =>
        row.status === 'en_route' && row.departmentId === deposit.departmentId
          ? [
              {
                id: row.id,
                title: describeParcel(row, 'onTour', context, now, t).recipient,
                line: carrierLineOf(row, t),
              },
            ]
          : [],
      ),
    };
  }, [depositId]);
  const profile = useOperatingProfile();
  const each = profile !== undefined && confirmsEachParcel(profile);
  const [received, setReceived] = useState<readonly string[]>([]);
  const live = data?.parcels.length ?? 0;
  const [counted, setCounted] = useState<number | null>(null);
  const [opened, setOpened] = useState(false);
  const [kind, setKind] = useState<DepositGap | null>(null);
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [unknown, setUnknown] = useState(false);
  useEffect(
    () => setCounted((seen) => seen ?? (data ? live : null)),
    [data, live],
  );
  const count = each ? received.length : (counted ?? live);
  const gapOpen = !each && (opened || count !== live);
  const gapKind = kind ?? kindOf(count, live);
  const confirm = useMutation({
    mutationFn: () =>
      trpcClient.deposits.confirm.mutate({
        depositId,
        counted: count,
        received: each ? [...received] : null,
        gap: gapOpen
          ? {
              kind: gapKind,
              parcelIds: gapKind === 'extra' || unknown ? null : [...picked],
            }
          : null,
      }),
    onSuccess: () => syncNow({ force: true }),
  });
  const close = () => void navigate({ to: '/departement/depots' });

  if (!data) return null;
  const { deposit, parcels } = data;
  if (!deposit) {
    return (
      <DepositDoneScreen
        title={t('deposit.error.notFound')}
        line=""
        rows={[]}
        actionLabel={t('deposit.done.back')}
        actionIcon={false}
        onAction={close}
      />
    );
  }
  if (!isPending(deposit)) {
    const held = deposit.gapParcelIds?.length ?? 0;
    const time = formatTime(deposit.confirmedAt ?? deposit.postedAt);
    return (
      <DepositDoneScreen
        title={
          deposit.announced - held === 1
            ? t('deposits.done.title.one')
            : t('deposits.done.title', { count: deposit.announced - held })
        }
        line={t('deposit.done.lineNoName', { time })}
        gap={
          deposit.gap
            ? {
                title: t('deposit.done.gap'),
                description: gapLine(deposit, name, t),
              }
            : undefined
        }
        rows={depositMailRows(data.mails, t)}
        actionLabel={t('deposits.done.action')}
        actionIcon={false}
        onAction={close}
      />
    );
  }

  const short = live - count;
  const gapReady =
    gapKind === 'extra'
      ? count > live
      : gapKind === 'missing'
        ? short > 0 && (unknown || picked.length === short)
        : unknown || picked.length > 0;
  const by = deposit.shuttleName ?? t('deposits.shuttle');
  return (
    <DepartmentDepositMobile
      title={t('deposits.of', { name: by })}
      line={
        live === 1
          ? t('deposits.line.one', { time: formatTime(deposit.postedAt) })
          : t('deposits.line', {
              time: formatTime(deposit.postedAt),
              count: live,
            })
      }
      counted={count}
      onCount={setCounted}
      countedLabel={t('deposits.counted')}
      confirmLabel={
        gapOpen || (each && count !== live)
          ? t('deposits.confirm.gap', { count })
          : t('deposits.confirm', { parcels: parcelsLabel(count, t) })
      }
      disabled={!online || confirm.isPending || (gapOpen && !gapReady)}
      notice={
        !online
          ? {
              title: t('deposits.offline.title'),
              description: t('deposits.offline.description'),
            }
          : confirm.isError
            ? {
                title: t('deposits.failed'),
                description: confirm.error.message,
              }
            : undefined
      }
      onConfirm={() => confirm.mutate()}
      onClose={close}
      gapAction={
        gapOpen || each
          ? undefined
          : { label: t('deposits.gap.open'), onClick: () => setOpened(true) }
      }
      each={
        each
          ? {
              hint: t('deposits.each.hint'),
              parcels: parcels.map((parcel) => ({
                ...parcel,
                checked: received.includes(parcel.id),
              })),
              onParcel: (id) =>
                setReceived((seen) =>
                  seen.includes(id)
                    ? seen.filter((one) => one !== id)
                    : [...seen, id],
                ),
            }
          : undefined
      }
      gap={
        gapOpen
          ? {
              banner: {
                title:
                  gapKind === 'left'
                    ? t('deposits.gap.left.title')
                    : short > 0
                      ? t('deposits.gap.short', { count: short })
                      : short < 0
                        ? t('deposits.gap.extra', { count: -short })
                        : t('deposits.gap.same'),
                description:
                  gapKind === 'extra'
                    ? t('deposits.gap.extra.description')
                    : t('deposits.gap.pick'),
              },
              kinds: DEPOSIT_GAPS.map((id) => ({
                id,
                label: t(`deposits.gap.kind.${id}`),
              })),
              kind: gapKind,
              onKind: (id) => setKind(id as DepositGap),
              parcels:
                gapKind === 'extra'
                  ? []
                  : parcels.map((parcel) => ({
                      ...parcel,
                      checked: picked.includes(parcel.id),
                    })),
              onParcel: (id) => {
                setUnknown(false);
                setPicked((seen) =>
                  seen.includes(id)
                    ? seen.filter((one) => one !== id)
                    : [...seen, id],
                );
              },
              unknown: {
                title: t('deposits.gap.unknown'),
                line:
                  live === 1
                    ? t('deposits.gap.unknown.line.one')
                    : t('deposits.gap.unknown.line', { count: live }),
                checked: unknown,
              },
              onUnknown: () => {
                setPicked([]);
                setUnknown((seen) => !seen);
              },
            }
          : undefined
      }
    />
  );
}
