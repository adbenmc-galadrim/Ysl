import { RouterProvider } from '@tanstack/react-router';
import ReactDOM from 'react-dom/client';
import { AppProvider } from '#/app/provider';
import { router } from '#/app/router';
import { bootLocalStore } from '#/features/db/boot';
import { bootCorners } from '#/features/settings/corners';
import { bootTheme } from '#/features/settings/theme';
import { startUpdater } from '#/features/update/updater';
import '#/styles.css';

// The build injects a title for the first paint; HeadContent owns it once React mounts.
document.querySelector('title[data-boot-title]')?.remove();

bootCorners();
bootTheme();
startUpdater();

const rootElement = document.getElementById('app');

if (rootElement && !rootElement.innerHTML) {
  ReactDOM.createRoot(rootElement).render(
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>,
  );
  void bootLocalStore();
}
