import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '#/features/db/database';
import { useMinuteClock } from '#/features/parcels/api/use-parcels';
import { listSearchEntries } from '#/features/search/api/search-entries';
import { SearchView } from '#/features/search/components/search-view';

export const Route = createFileRoute('/_authenticated/recherche')({
  component: SearchPage,
});

function SearchPage() {
  const navigate = useNavigate();
  const now = useMinuteClock();
  const entries = useLiveQuery(() => listSearchEntries(db, now), [now]);
  return (
    <SearchView
      entries={entries}
      now={now}
      onCancel={() => void navigate({ to: '/' })}
    />
  );
}
