export const PASSWORD_VARIABLE = 'AUTH_USER_PASSWORD';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

export async function readPassword(): Promise<string> {
  const fromVariable = process.env[PASSWORD_VARIABLE];
  if (fromVariable) return fromVariable;
  if (process.stdin.isTTY) return '';
  return (await readStdin()).replace(/\r?\n$/, '');
}
