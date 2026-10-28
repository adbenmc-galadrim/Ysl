import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { JournalRemisesScreen, RemiseDetailScreen } from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import { loadHandoverEntry } from '#/features/handover/entry';
import {
  describeHandoverDetail,
  journalSections,
  loadJournal,
} from '#/features/handover/journal';
import { useMinuteClock } from '#/features/parcels/api/use-parcels';

const t = createTranslator(DEFAULT_LOCALE);

export type JournalRemisesPageProps = {
  onBack: () => void;
  onOpen: (handoverId: string) => void;
};

/** F43: every handover of the mailroom, by day, searchable by name. */
export function JournalRemisesPage({
  onBack,
  onOpen,
}: JournalRemisesPageProps) {
  const now = useMinuteClock();
  const session = useSession();
  const [query, setQuery] = useState('');
  const items = useLiveQuery(() => loadJournal(db), []);
  if (!items) return null;
  return (
    <JournalRemisesScreen
      query={query}
      onQueryChange={setQuery}
      sections={journalSections(items, query, now, t, session.user.id)}
      empty={{
        title: t('journal.empty.title'),
        description: query.trim()
          ? t('journal.empty.search', { query: query.trim() })
          : t('journal.empty.none'),
      }}
      onBack={onBack}
      onOpen={(entry) => onOpen(entry.id)}
    />
  );
}

export type RemiseDetailPageProps = {
  handoverId: string;
  onBack: () => void;
  onParcel: (parcelId: string) => void;
};

/** One handover: to whom, when, which agent, how, and its parcels. */
export function RemiseDetailPage({
  handoverId,
  onBack,
  onParcel,
}: RemiseDetailPageProps) {
  const now = useMinuteClock();
  const session = useSession();
  const entry = useLiveQuery(
    () => loadHandoverEntry(db, handoverId),
    [handoverId],
  );
  useEffect(() => {
    if (entry === null) onBack();
  }, [entry, onBack]);
  if (!entry) return null;
  return (
    <RemiseDetailScreen
      {...describeHandoverDetail(entry, now, t, session.user.id)}
      onBack={onBack}
      onParcel={(parcel) => onParcel(parcel.id)}
    />
  );
}
