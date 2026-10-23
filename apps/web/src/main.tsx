import { RouterProvider } from '@tanstack/react-router';
import ReactDOM from 'react-dom/client';
import { AppProvider } from '#/app/provider';
import { router } from '#/app/router';
import { registerServiceWorker } from '#/lib/service-worker';
import '#/styles.css';

// The build injects a title for the first paint; HeadContent owns it once React mounts.
document.querySelector('title[data-boot-title]')?.remove();

registerServiceWorker();

const rootElement = document.getElementById('app');

if (rootElement && !rootElement.innerHTML) {
  ReactDOM.createRoot(rootElement).render(
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>,
  );
}
