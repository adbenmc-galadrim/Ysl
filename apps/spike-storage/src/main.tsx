import { createRoot } from 'react-dom/client';
import { App } from '#/app';
import { readDevice } from '#/device';
import { Journal } from '#/journal';
import { SpikeDatabase } from '#/storage/db';
import { savePhoto } from '#/storage/opfs';
import { generatePhoto } from '#/storage/photo';
import { Writer } from '#/storage/writer';
import { Updater } from '#/update/register';
import '#/styles.css';

const journal = new Journal(localStorage, readDevice());
journal.log('app-started', __APP_VERSION__);
if (journal.interrupted) {
  journal.log('previous-session-interrupted', journal.interrupted.id);
}
if (journal.writeInterrupted) {
  journal.log('previous-write-interrupted', journal.writeInterrupted.id);
}

const updater = new Updater(
  (name, detail) => journal.log(name, detail),
  __APP_VERSION__,
  (reason) => journal.close(reason),
);
updater.start();
window.addEventListener('pagehide', () => journal.close('pagehide'));
window.addEventListener('pageshow', (event) => {
  if (event.persisted) journal.reopen();
});

const db = new SpikeDatabase();
const writer = new Writer({
  db,
  savePhoto,
  makePhoto: generatePhoto,
  log: (name, detail) => journal.log(name, detail),
  sessionId: journal.session.id,
});

const rootElement = document.getElementById('app');

if (rootElement) {
  createRoot(rootElement).render(
    <App
      journal={journal}
      updater={updater}
      writer={writer}
      db={db}
      version={__APP_VERSION__}
    />,
  );
}
