import { useQuery } from '@tanstack/react-query';
import { readStorageStatus } from '#/features/db/storage';

export function useStorageStatus() {
  return useQuery({
    queryKey: ['storage-status'],
    queryFn: readStorageStatus,
    staleTime: 0,
    networkMode: 'always',
  });
}
