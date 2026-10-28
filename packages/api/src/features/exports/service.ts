import type { AnyDb } from '@repo/db';
import {
  EXPORT_TIME_ZONE,
  parcelsCsvFilename,
  type ParcelsCsvOutput,
} from '@repo/contract/exports';
import { DAMAGE_LABEL, damageOf } from '@repo/contract/parcel-damage';
import { STATUS_LABEL, type ParcelStatus } from '@repo/contract/parcel-status';
import { contact, directoryPerson, handover, parcel } from '@repo/db/schema';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { textCell, toCsv, type CsvCell } from '#features/exports/csv';

const translate = createTranslator(DEFAULT_LOCALE);

/** The v1 columns in their exact order (retro v1 §3.2), then what v2 adds. */
export const PARCELS_CSV_HEADER = [
  'id',
  'date_reception',
  'date_remise',
  'statut',
  'transporteur',
  'tracking',
  'destinataire',
  'email',
  'departement',
  'expediteur',
  'nb_colis',
  'notes',
  'statut_v2',
  'type',
  'service_transporteur',
  'reference',
  'poids_kg',
  'emplacement',
  'date_notification',
  'derniere_notification',
  'reserve',
  'remis_le',
  'remis_a',
  'remis_par',
  'methode_remise',
  'remise_annulee',
  'signature',
  'photo_remise',
] as const;

/** The v1 vocabulary, so an export still reads as one to the v1 import. */
const V1_STATUS: Record<ParcelStatus, string> = {
  a_completer: 'En attente',
  recu: 'Recu',
  notifie: 'Notifie',
  remis: 'Remis',
  retourne: 'Retourne',
};

const TYPE_LABEL = {
  colis: 'parcel.type.colis',
  recommande: 'parcel.type.recommande',
  sans_suivi: 'parcel.type.sans_suivi',
} as const;

const dateTime = new Intl.DateTimeFormat('fr-FR', {
  timeZone: EXPORT_TIME_ZONE,
  dateStyle: 'short',
  timeStyle: 'short',
});

const kilograms = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 3,
  useGrouping: false,
});

/** "26/10/2026 14:32": Excel set to French reads it as a date. */
export function formatExportDate(date: Date | null): string {
  return date ? dateTime.format(date) : '';
}

async function readParcels(db: AnyDb, organizationId: string) {
  return db
    .select({
      parcel,
      person: {
        firstName: directoryPerson.firstName,
        lastName: directoryPerson.lastName,
        email: directoryPerson.email,
        department: directoryPerson.department,
      },
      contact: { name: contact.name, email: contact.email },
    })
    .from(parcel)
    .leftJoin(
      directoryPerson,
      and(
        eq(directoryPerson.organizationId, parcel.organizationId),
        eq(directoryPerson.id, parcel.personId),
      ),
    )
    .leftJoin(
      contact,
      and(
        eq(contact.organizationId, parcel.organizationId),
        eq(contact.id, parcel.contactId),
      ),
    )
    .where(
      and(eq(parcel.organizationId, organizationId), isNull(parcel.deletedAt)),
    )
    .orderBy(asc(parcel.receivedAt), asc(parcel.id));
}

type ExportedParcel = Awaited<ReturnType<typeof readParcels>>[number];

async function readHandovers(db: AnyDb, organizationId: string) {
  return db
    .select({
      id: handover.id,
      parcelIds: handover.parcelIds,
      recipientName: handover.recipientName,
      delegateName: handover.delegateName,
      method: handover.method,
      agentName: handover.agentName,
      at: handover.at,
      cancelledAt: handover.cancelledAt,
      hasSignature: handover.hasSignature,
      hasPhoto: handover.hasPhoto,
    })
    .from(handover)
    .where(
      and(
        eq(handover.organizationId, organizationId),
        isNull(handover.deletedAt),
      ),
    )
    .orderBy(asc(handover.at), asc(handover.id));
}

type ExportedHandover = Awaited<ReturnType<typeof readHandovers>>[number];

/**
 * The handover each parcel's line tells (F43): the standing one that wrote
 * its `delivered_at`, else the latest standing one, else the latest
 * cancelled one — a parcel handed back after a cancellation says so.
 */
function handoverByParcel(
  rows: ExportedParcel[],
  handovers: ExportedHandover[],
): Map<string, ExportedHandover> {
  const deliveredAt = new Map(
    rows.map(({ parcel: p }) => [p.id, p.deliveredAt?.getTime()]),
  );
  const rank = (row: ExportedHandover, parcelId: string) =>
    row.cancelledAt
      ? 0
      : row.at.getTime() === deliveredAt.get(parcelId)
        ? 2
        : 1;
  const byParcel = new Map<string, ExportedHandover>();
  for (const row of handovers) {
    for (const parcelId of row.parcelIds) {
      const held = byParcel.get(parcelId);
      if (!held || rank(row, parcelId) >= rank(held, parcelId)) {
        byParcel.set(parcelId, row);
      }
    }
  }
  return byParcel;
}

/** « oui » or « non »: the file says a proof exists, the proof stays on the iPhone (D8). */
const yesNo = (value: boolean) => translate(value ? 'export.yes' : 'export.no');

function handoverCells(row: ExportedHandover | undefined): CsvCell[] {
  if (!row) return ['', '', '', '', '', '', ''];
  return [
    formatExportDate(row.at),
    row.delegateName
      ? translate('export.handover.delegate', {
          name: row.recipientName,
          delegate: row.delegateName,
        })
      : row.recipientName,
    row.agentName,
    translate(`handover.method.${row.method}`),
    formatExportDate(row.cancelledAt),
    yesNo(row.hasSignature),
    yesNo(row.hasPhoto),
  ];
}

function toCells(
  { parcel: p, person, contact: c }: ExportedParcel,
  handed: ExportedHandover | undefined,
): CsvCell[] {
  const recipient = person
    ? `${person.firstName} ${person.lastName}`.trim()
    : (c?.name ?? p.readName);
  return [
    p.id,
    formatExportDate(p.receivedAt),
    formatExportDate(p.deliveredAt),
    V1_STATUS[p.status],
    p.carrier,
    textCell(p.tracking),
    recipient,
    p.notificationEmail ?? person?.email ?? c?.email,
    p.department ?? person?.department,
    p.senderName,
    // Pieces received here ("2 sur 3" counts 2), what v1 called nb_colis.
    String(p.pieceN ?? 1),
    p.notes,
    translate(STATUS_LABEL[p.status]),
    translate(TYPE_LABEL[p.type]),
    p.carrierService,
    textCell(p.reference),
    p.weightKg === null ? '' : kilograms.format(p.weightKg),
    p.location,
    formatExportDate(p.notifiedAt),
    formatExportDate(p.lastNotifiedAt),
    reserveCell(p),
    ...handoverCells(handed),
  ];
}

/** "Carton abîmé : coin enfoncé", empty without a reserve. */
function reserveCell(row: ExportedParcel['parcel']): string {
  const damage = damageOf(row);
  if (!damage) return '';
  const label = DAMAGE_LABEL[damage.reason];
  return damage.note ? `${label} : ${damage.note}` : label;
}

/** F51: every parcel the mailroom still holds a record of, for Excel. */
export async function exportParcelsCsv(
  db: AnyDb,
  organizationId: string,
  now = new Date(),
): Promise<ParcelsCsvOutput> {
  const [rows, handovers] = await Promise.all([
    readParcels(db, organizationId),
    readHandovers(db, organizationId),
  ]);
  const handed = handoverByParcel(rows, handovers);
  return {
    filename: parcelsCsvFilename(now),
    csv: toCsv(
      PARCELS_CSV_HEADER,
      rows.map((row) => toCells(row, handed.get(row.parcel.id))),
    ),
    count: rows.length,
  };
}
