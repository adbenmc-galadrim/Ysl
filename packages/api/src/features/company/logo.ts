import {
  LOGO_MAX_BYTES,
  LOGO_MAX_SIDE,
  LOGO_MIN_SIDE,
  type LogoProblem,
  type LogoType,
} from '@repo/contract/company-settings';
import type { AnyDb } from '@repo/db';
import { companyLogo } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { writeCompanySettings } from '#features/company/settings';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type Inspected = { contentType: LogoType; width: number; height: number };

function pngSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes.toString('latin1', 12, 16) !== 'IHDR') {
    return null;
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** The frame header of a JPEG, past the segments before it. */
function jpegSize(bytes: Buffer): { width: number; height: number } | null {
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1]!;
    const isFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isFrame) {
      return {
        height: bytes.readUInt16BE(at + 5),
        width: bytes.readUInt16BE(at + 7),
      };
    }
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  return null;
}

/**
 * What the file really is, by its bytes and never by what the browser says. Only
 * PNG and JPEG: an SVG can carry a script, and every mail client reads these two.
 */
export function inspectLogo(bytes: Buffer): Inspected | LogoProblem {
  if (bytes.length > LOGO_MAX_BYTES) return 'size';
  let contentType: LogoType;
  let size: { width: number; height: number } | null;
  if (bytes.subarray(0, 8).equals(PNG)) {
    contentType = 'image/png';
    size = pngSize(bytes);
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    contentType = 'image/jpeg';
    size = jpegSize(bytes);
  } else {
    return 'type';
  }
  if (!size) return 'type';
  const { width, height } = size;
  const fits = (side: number) => side >= LOGO_MIN_SIDE && side <= LOGO_MAX_SIDE;
  return fits(width) && fits(height)
    ? { contentType, width, height }
    : 'dimensions';
}

/** A new `id` at each upload: the URL it was served from stays cached for good. */
export async function saveLogo(
  db: AnyDb,
  organizationId: string,
  bytes: Buffer,
  updatedBy: string,
): Promise<{ logoId: string } | LogoProblem> {
  const inspected = inspectLogo(bytes);
  if (typeof inspected === 'string') return inspected;
  return db.transaction(async (tx) => {
    await tx
      .delete(companyLogo)
      .where(eq(companyLogo.organizationId, organizationId));
    const [row] = await tx
      .insert(companyLogo)
      .values({ organizationId, bytes, updatedBy, ...inspected })
      .returning({ id: companyLogo.id });
    await writeCompanySettings(
      tx,
      organizationId,
      { logoId: row!.id },
      updatedBy,
    );
    return { logoId: row!.id };
  });
}

export async function removeLogo(
  db: AnyDb,
  organizationId: string,
  updatedBy: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(companyLogo)
      .where(eq(companyLogo.organizationId, organizationId));
    await writeCompanySettings(tx, organizationId, { logoId: null }, updatedBy);
  });
}

/** For the public route: an e-mail client has no session. */
export async function logoFile(
  db: AnyDb,
  id: string,
): Promise<{ bytes: Buffer; contentType: LogoType } | null> {
  const [row] = await db
    .select({ bytes: companyLogo.bytes, contentType: companyLogo.contentType })
    .from(companyLogo)
    .where(eq(companyLogo.id, id));
  return row ?? null;
}
