import Dexie, { type EntityTable } from 'dexie';

export type Parcel = {
  id: number;
  seq: number;
  createdAt: number;
  photoName: string;
  photoBytes: number;
  photoSha256: string;
  sessionId: string;
};

export type OutboxEntry = {
  id: number;
  parcelId: number;
  createdAt: number;
  op: 'create';
};

export class SpikeDatabase extends Dexie {
  parcels!: EntityTable<Parcel, 'id'>;
  outbox!: EntityTable<OutboxEntry, 'id'>;

  constructor(name = 'spike-storage') {
    super(name);
    this.version(1).stores({
      parcels: '++id, seq, createdAt',
      outbox: '++id, parcelId, createdAt',
    });
  }
}
