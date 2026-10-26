import { z } from 'zod';

/** The opening days the Lieu et horaires screen lists, Monday first. */
export const PICKUP_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;

export type PickupDay = (typeof PICKUP_DAYS)[number];

export const PICKUP_PLACE_MAX = 120;
export const PICKUP_HOURS_MAX = 60;
export const PICKUP_INSTRUCTIONS_MAX = 400;

/**
 * Where and when a parcel is collected, as every e-mail quotes it (F35, D13):
 * free text the service writes, read back exactly, an empty day being closed.
 */
export const pickupSetting = z.strictObject({
  place: z.string().max(PICKUP_PLACE_MAX),
  hours: z.strictObject(
    Object.fromEntries(
      PICKUP_DAYS.map((day) => [day, z.string().max(PICKUP_HOURS_MAX)]),
    ) as Record<PickupDay, z.ZodString>,
  ),
  instructions: z.string().max(PICKUP_INSTRUCTIONS_MAX),
});

export type PickupSetting = z.infer<typeof pickupSetting>;

/** The value of each key of the `setting` table, one row per key and mailroom. */
export const SETTING_VALUES = {
  pickup: pickupSetting,
} as const satisfies Record<string, z.ZodType>;

export type SettingKey = keyof typeof SETTING_VALUES;

export function isSettingKey(key: unknown): key is SettingKey {
  return typeof key === 'string' && Object.hasOwn(SETTING_VALUES, key);
}

export const EMPTY_PICKUP: PickupSetting = {
  place: '',
  hours: { mon: '', tue: '', wed: '', thu: '', fri: '' },
  instructions: '',
};

/** The stored value, or nothing filled in when there is none or it does not parse. */
export function parsePickup(value: unknown): PickupSetting {
  const parsed = pickupSetting.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_PICKUP;
}
