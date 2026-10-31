import { useCallback, useSyncExternalStore } from 'react';

/** From where a screen is laid out for a computer. */
export const DESK_WIDTH = '(min-width: 1280px)';

export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => false,
  );
}
