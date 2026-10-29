import { createFileRoute } from '@tanstack/react-router';
import { NotifierPage } from '#/features/mail/components/notifier-page';
import { searchIds } from '#/lib/search-ids';

type NotifierSearch = {
  colis?: string;
  lot?: string;
  relance?: boolean;
  prevenir?: boolean;
  /** Parcels ticked on Colis (F31), then the reminders that follow. */
  selection?: string[];
  ensuite?: string[];
  sansDestinataire?: number;
  sansEmail?: number;
};

const count = (value: unknown): number => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

export const Route = createFileRoute('/_authenticated/notifier')({
  validateSearch: (search: Record<string, unknown>): NotifierSearch => ({
    ...(typeof search.colis === 'string' ? { colis: search.colis } : {}),
    ...(typeof search.lot === 'string' ? { lot: search.lot } : {}),
    ...(search.relance === true || search.relance === 'true'
      ? { relance: true }
      : {}),
    ...(search.prevenir === true || search.prevenir === 'true'
      ? { prevenir: true }
      : {}),
    ...(searchIds(search.selection)
      ? { selection: searchIds(search.selection) }
      : {}),
    ...(searchIds(search.ensuite)
      ? { ensuite: searchIds(search.ensuite) }
      : {}),
    ...(count(search.sansDestinataire)
      ? { sansDestinataire: count(search.sansDestinataire) }
      : {}),
    ...(count(search.sansEmail) ? { sansEmail: count(search.sansEmail) } : {}),
  }),
  component: NotifierRoute,
});

function NotifierRoute() {
  const {
    colis,
    lot,
    relance,
    prevenir,
    selection,
    ensuite,
    sansDestinataire,
    sansEmail,
  } = Route.useSearch();
  return (
    <NotifierPage
      key={`${colis ?? ''}:${lot ?? ''}:${relance ? 'relance' : ''}:${prevenir ? 'prevenir' : ''}:${selection?.join(',') ?? ''}`}
      selection={selection}
      then={ensuite}
      skipped={
        sansDestinataire || sansEmail
          ? { recipient: sansDestinataire ?? 0, address: sansEmail ?? 0 }
          : undefined
      }
      parcelId={colis}
      batchId={lot}
      reminder={relance}
      otherWay={prevenir}
    />
  );
}
