import { getRouteApi } from '@tanstack/react-router';

const authenticated = getRouteApi('/_authenticated');

/** The signed-in agent, as `_authenticated` loaded it before rendering. */
export function useSession() {
  return authenticated.useRouteContext().session;
}
