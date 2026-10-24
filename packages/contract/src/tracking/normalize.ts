export const normalizeTracking = (raw: string) =>
  raw.toUpperCase().replace(/[\s\-.]/g, '');
