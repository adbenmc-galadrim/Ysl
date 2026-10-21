import '#load-env';

const readPort = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 && value < 65536
    ? value
    : fallback;
};

export const WEB_PORT = readPort('WEB_PORT', 3100);
export const SERVER_PORT = readPort('SERVER_PORT', 3101);
export const POSTGRES_PORT = readPort('POSTGRES_PORT', 5440);

export const DEFAULT_DATABASE_URL = `postgresql://postgres:postgres@localhost:${POSTGRES_PORT}/courrier`;
