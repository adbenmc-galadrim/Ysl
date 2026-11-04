import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** The kernel matches real paths: `/var` or `/tmp` behind a link would slip by. */
const real = (path: string) => (existsSync(path) ? realpathSync(path) : path);

const quote = (path: string) =>
  `"${real(path).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;

const SECRETS = [
  '.ssh',
  '.config',
  '.gnupg',
  '.aws',
  '.claude',
  '.netrc',
  '.gitconfig',
];

/**
 * DNS, and LaunchServices: an app started through it (a copied `open`,
 * `shortcuts`, an Apple Event) runs from launchd, outside this sandbox.
 */
const LOOKUPS = [
  'com.apple.mDNSResponder',
  'com.apple.dnssd.service',
  'com.apple.coreservices.launchservicesd',
  'com.apple.lsd.mapdb',
  'com.apple.lsd.modifydb',
  'com.apple.coreservices.quarantine-resolver',
];

/**
 * macOS sandbox for the agent's code run by the hook (gates, bench): no
 * network, Unix sockets only in its own short temporary folder (tsx's IPC),
 * no DNS, no app started outside it (LaunchServices, Apple Events), no read of the
 * PC's keys, writes only in the worktree, the work folder and that folder.
 */
export const profile = (writable: string[], tmp: string, home = homedir()) => {
  const sub = (dir: string) => `(subpath ${quote(dir)})`;
  return [
    '(version 1)',
    '(allow default)',
    '(deny network*)',
    `(allow network* (local unix-socket ${sub(tmp)}) (remote unix-socket ${sub(tmp)}))`,
    `(deny mach-lookup ${LOOKUPS.map((name) => `(global-name "${name}")`).join(' ')})`,
    '(deny appleevent-send)',
    `(deny process-exec ${['open', 'osascript', 'shortcuts', 'automator', 'ssh', 'scp'].map((bin) => `(literal "/usr/bin/${bin}")`).join(' ')})`,
    `(deny file-read* ${SECRETS.map((name) => sub(join(home, name))).join(' ')})`,
    `(deny file-write* ${sub(home)})`,
    `(allow file-write* ${[...writable, tmp].map(sub).join(' ')})`,
  ].join('\n');
};
