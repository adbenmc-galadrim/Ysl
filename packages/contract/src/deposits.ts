import { z } from 'zod';

/** What a department may say against a deposit (D25): one short, one too many, an employee gone. */
export const DEPOSIT_GAPS = ['missing', 'extra', 'left'] as const;

export type DepositGap = (typeof DEPOSIT_GAPS)[number];

const QR_PREFIX = 'courrier:depot:';

/** What the poster of a department says: its id, no secret, the list offers the same choice. */
export const departmentQrText = (departmentId: string) =>
  `${QR_PREFIX}${departmentId}`;

export function readDepartmentQr(text: string): string | null {
  if (!text.startsWith(QR_PREFIX)) return null;
  const id = text.slice(QR_PREFIX.length);
  return z.uuid().safeParse(id).success ? id : null;
}

export const confirmDepositInput = z.object({
  depositId: z.uuid(),
  counted: z.number().int().min(0).max(10_000),
  gap: z
    .object({
      kind: z.enum(DEPOSIT_GAPS),
      /** Those it concerns; null when the department cannot say: all of them wait. */
      parcelIds: z.array(z.uuid()).max(10_000).nullable(),
    })
    .nullable(),
});

export type ConfirmDepositInput = z.infer<typeof confirmDepositInput>;

export const confirmDepositOutput = z.object({
  deposited: z.number(),
  toSettle: z.number(),
});

/** Which of the parcels of a deposit wait « À régulariser »; the others are deposited. */
export function parcelsToSettle(
  parcelIds: readonly string[],
  gap: ConfirmDepositInput['gap'],
): string[] {
  if (!gap || gap.kind === 'extra') return [];
  if (!gap.parcelIds) return [...parcelIds];
  return parcelIds.filter((id) => gap.parcelIds?.includes(id));
}

export const settleParcelInput = z.discriminatedUnion('action', [
  /** Found: back on the way to the department it was going to. */
  z.object({ action: z.literal('redeposit'), parcelId: z.uuid() }),
  /** To another department: a parcel for nobody in the directory. */
  z.object({
    action: z.literal('department'),
    parcelId: z.uuid(),
    departmentId: z.uuid(),
  }),
  /** To a person, or the same one where they are now: the parcel follows them. */
  z.object({
    action: z.literal('person'),
    parcelId: z.uuid(),
    personId: z.uuid(),
  }),
  z.object({ action: z.literal('return'), parcelId: z.uuid() }),
  z.object({ action: z.literal('lost'), parcelId: z.uuid() }),
]);

export type SettleParcelInput = z.infer<typeof settleParcelInput>;

export const entrustParcelsInput = z.object({
  parcelIds: z.array(z.uuid()).min(1).max(1_000),
  shuttleId: z.string().min(1),
});

const settlementParcel = z.object({
  id: z.uuid(),
  status: z.string(),
  departmentId: z.uuid().nullable(),
  personId: z.uuid().nullable(),
  recipient: z.string().nullable(),
  carrier: z.string().nullable(),
  tracking: z.string().nullable(),
  carrierId: z.string(),
  carrierName: z.string().nullable(),
  since: z.date(),
  gap: z
    .object({
      kind: z.enum(DEPOSIT_GAPS).nullable(),
      counted: z.number().nullable(),
      announced: z.number(),
      confirmedAt: z.date().nullable(),
      confirmedByName: z.string().nullable(),
    })
    .nullable(),
});

export type SettlementParcel = z.infer<typeof settlementParcel>;

/** What the company admin has to decide, and with whom. */
export const settlementOutput = z.object({
  toSettle: z.array(settlementParcel),
  withoutDepartment: z.array(settlementParcel),
  carried: z.array(settlementParcel),
  /** Deposits with one too many: no parcel to show, the count stands alone. */
  extras: z.array(
    z.object({
      id: z.uuid(),
      departmentId: z.uuid(),
      announced: z.number(),
      counted: z.number(),
      confirmedAt: z.date(),
      confirmedByName: z.string().nullable(),
    }),
  ),
  departments: z.array(z.object({ id: z.uuid(), name: z.string() })),
  shuttles: z.array(z.object({ id: z.string(), name: z.string() })),
});

export type SettlementOutput = z.infer<typeof settlementOutput>;
