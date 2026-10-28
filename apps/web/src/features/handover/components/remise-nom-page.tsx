import { QuiRetireScreen } from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDeferredValue, useMemo, useState } from 'react';
import { db } from '#/features/db/database';
import { collectors, recipientOfRow } from '#/features/handover/collectors';
import type { HandoverRecipient } from '#/features/handover/waiting';
import { waitingCounts } from '#/features/handover/waiting';

export type RemiseNomPageProps = {
  onPick: (recipient: HandoverRecipient) => void;
  onClose: () => void;
};

/** No QR, no code: the agent looks the person up; a signature will be asked (YSL-75). */
export function RemiseNomPage({ onPick, onClose }: RemiseNomPageProps) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const data = useLiveQuery(async () => {
    const [people, contacts, counts] = await Promise.all([
      db.directoryPerson.toArray(),
      db.contact.toArray(),
      waitingCounts(db),
    ]);
    return { people, contacts, counts };
  }, []);
  const { waiting, others } = useMemo(
    () =>
      data
        ? collectors(data.people, data.contacts, data.counts, deferred)
        : { waiting: [], others: [] },
    [data, deferred],
  );
  return (
    <QuiRetireScreen
      query={query}
      onQueryChange={setQuery}
      waiting={waiting}
      others={others}
      onPick={(person) => onPick(recipientOfRow(person.id))}
      onClose={onClose}
    />
  );
}
