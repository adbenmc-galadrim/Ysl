import type { PlatformOverviewOutput } from '@repo/contract/platform';
import type { AnyDb } from '@repo/db';
import { organization } from '@repo/db/schema';
import { count } from 'drizzle-orm';

export async function getPlatformOverview(
  db: AnyDb,
): Promise<PlatformOverviewOutput> {
  const [row] = await db.select({ companies: count() }).from(organization);
  return { companies: row?.companies ?? 0 };
}
