import type { Parcel } from '@repo/ui';
import { queryOptions } from '@tanstack/react-query';

/** The parcels of this iPhone. Empty until the local database arrives. */
export const listParcelsQueryOptions = queryOptions({
  queryKey: ['parcels'],
  queryFn: (): Promise<Parcel[]> => Promise.resolve([]),
  staleTime: Infinity,
});
