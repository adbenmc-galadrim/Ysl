/** A list of ids carried in a route's search, e.g. the parcels ticked on Colis; nothing when empty or malformed. */
export function searchIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value.filter((id): id is string => typeof id === 'string');
  return ids.length ? ids : undefined;
}
