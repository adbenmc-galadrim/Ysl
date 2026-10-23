import { registerSW } from 'virtual:pwa-register';
import { errorDetail } from '#/errors';
import { checkVersion } from '#/update/version';

type Log = (name: string, detail?: string) => void;

export type UpdateState = {
  worker: string;
  needRefresh: boolean;
  remoteVersion: string | undefined;
  lastCheckAt: number | undefined;
};

const CHECK_INTERVAL_MS = 5 * 60_000;

export class Updater {
  private state: UpdateState = {
    worker: 'serviceWorker' in navigator ? 'enregistrement' : 'non supporté',
    needRefresh: false,
    remoteVersion: undefined,
    lastCheckAt: undefined,
  };
  private readonly listeners = new Set<() => void>();
  private registration: ServiceWorkerRegistration | undefined;
  private applyWaiting: ((reload?: boolean) => Promise<void>) | undefined;
  private returnedAt: number | undefined;

  constructor(
    private readonly log: Log,
    private readonly localVersion: string,
  ) {}

  start(): void {
    this.applyWaiting = registerSW({
      onRegisteredSW: (_url, registration) => {
        this.registration = registration;
        this.patch({ worker: registration ? 'actif' : 'enregistrement' });
        this.log('sw-registered', registration?.scope);
        void this.updateRegistration('démarrage');
      },
      onNeedRefresh: () => {
        this.log('sw-waiting');
        this.patch({ worker: 'mise à jour en attente', needRefresh: true });
        this.reportDelay();
      },
      onOfflineReady: () => this.log('offline-ready'),
      onRegisterError: (error: unknown) =>
        this.log('sw-register-failed', errorDetail(error)),
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      this.returnedAt = Date.now();
      void this.check('retour au premier plan');
    });
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        void this.check('toutes les 5 min');
      }
    }, CHECK_INTERVAL_MS);
    void this.checkRemoteVersion();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): UpdateState => this.state;

  check = async (reason: string): Promise<void> => {
    await Promise.all([
      this.updateRegistration(reason),
      this.checkRemoteVersion(),
    ]);
  };

  apply = (): void => {
    this.log('update-applied');
    void this.applyWaiting?.(true);
  };

  force = async (): Promise<void> => {
    this.log('force-update-started');
    try {
      const registrations =
        'serviceWorker' in navigator
          ? await navigator.serviceWorker.getRegistrations()
          : [];
      await Promise.all(
        registrations.map((registration) => registration.unregister()),
      );
      const keys = 'caches' in window ? await caches.keys() : [];
      await Promise.all(keys.map((key) => caches.delete(key)));
      this.log(
        'force-update-reload',
        `${registrations.length} service worker, ${keys.length} caches`,
      );
      location.reload();
    } catch (error) {
      this.log('force-update-failed', errorDetail(error));
    }
  };

  private async updateRegistration(reason: string): Promise<void> {
    if (!this.registration) return;
    this.log('update-started', reason);
    try {
      await this.registration.update();
    } catch (error) {
      this.log('update-failed', errorDetail(error));
    }
  }

  private async checkRemoteVersion(): Promise<void> {
    const result = await checkVersion(
      this.localVersion,
      new URL('version.json', document.baseURI).href,
    );
    this.patch({ lastCheckAt: Date.now() });
    if (result.kind === 'unknown') {
      this.log('version-unknown');
      return;
    }
    this.patch({ remoteVersion: result.remote });
    if (result.kind === 'different') {
      this.log('version-different', result.remote);
      this.reportDelay();
    }
  }

  private reportDelay(): void {
    if (this.returnedAt === undefined) return;
    this.log('detection-delay', `${Date.now() - this.returnedAt} ms`);
    this.returnedAt = undefined;
  }

  private patch(change: Partial<UpdateState>): void {
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) listener();
  }
}
