import { CourrierDatabase } from '#/features/db/schema';

/** The one local database of this device, opened on first use. */
export const db = new CourrierDatabase();
