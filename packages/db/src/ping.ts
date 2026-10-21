import { pool } from '#client';

const PROBE_TIMEOUT_MS = 2_000;

export async function pingDb(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`No answer from the database in ${PROBE_TIMEOUT_MS}ms`));
    }, PROBE_TIMEOUT_MS);
  });

  try {
    await Promise.race([pool.query('select 1'), expiry]);
  } finally {
    clearTimeout(timer);
  }
}
