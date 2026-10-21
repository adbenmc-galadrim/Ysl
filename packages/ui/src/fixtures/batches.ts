import { PARCELS, type Parcel } from '#fixtures/parcels';

/**
 * A reception batch cut short: seven parcels scanned at 10 h 31, none saved.
 * The first ones are the shared cast; the rest only need to exist, so they
 * are copies with their own ids.
 */
export const INTERRUPTED_BATCH: { startedAt: string; parcels: Parcel[] } = {
  startedAt: '10 h 31',
  parcels: [
    PARCELS.camille,
    PARCELS.ines,
    PARCELS.hugo,
    PARCELS.nora,
    PARCELS.malik,
    { ...PARCELS.nora, id: 'p-4472', last4: '4472' },
    { ...PARCELS.hugo, id: 'p-7113', last4: '7113' },
  ],
};
