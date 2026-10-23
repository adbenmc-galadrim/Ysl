import { createRoot } from 'react-dom/client';
import { App } from '#/app';
import { readDevice } from '#/device';
import { Journal } from '#/journal';
import { Updater } from '#/update/register';
import '#/styles.css';

const journal = new Journal(localStorage, readDevice());
journal.log('app-started', __APP_VERSION__);
if (journal.interrupted) {
  journal.log('previous-session-interrupted', journal.interrupted.id);
}

const updater = new Updater(
  (name, detail) => journal.log(name, detail),
  __APP_VERSION__,
);
updater.start();

const rootElement = document.getElementById('app');

if (rootElement) {
  createRoot(rootElement).render(
    <App
      journal={journal}
      updater={updater}
      version={__APP_VERSION__}
      writing={false}
    />,
  );
}
