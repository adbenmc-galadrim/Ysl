import type { HealthCheckOutput } from '@repo/contract/health';
import { pingDb } from '@repo/db';

export async function healthCheck(): Promise<HealthCheckOutput> {
  try {
    await pingDb();
    return { api: 'up', database: 'up' };
  } catch {
    return { api: 'up', database: 'down' };
  }
}
