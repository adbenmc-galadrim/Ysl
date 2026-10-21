import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContext = {
  requestId: string;
  procedure?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContext,
  run: () => T,
): T {
  return storage.run(context, run);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
