import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  clientPrefix: 'PUBLIC_',
  client: {
    PUBLIC_APP_NAME: z.string().min(1),
    PUBLIC_SERVER_URL: z.url(),
    PUBLIC_APP_URL: z.url(),
  },
  runtimeEnv: (
    import.meta as unknown as { env: Record<string, string | undefined> }
  ).env,
  emptyStringAsUndefined: true,
});
