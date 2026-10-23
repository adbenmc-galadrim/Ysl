import { registerSW } from 'virtual:pwa-register';

export function registerServiceWorker() {
  registerSW({
    immediate: true,
    onRegisterError: (error: unknown) => {
      console.warn('Service worker registration failed', error);
    },
  });
}
