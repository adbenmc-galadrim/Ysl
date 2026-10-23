import { createRoot } from 'react-dom/client';
import { App } from '#/app';
import { appBase } from '#/base';
import { RunJournal } from '#/metrics/run-journal';
import { Controller } from '#/run/controller';
import '#/styles.css';

const journal = new RunJournal(localStorage);
const controller = new Controller(journal, `${location.origin}${appBase}`);
void controller.loadPack();

Object.assign(window, {
  spikeOcr: {
    start: (request: Parameters<Controller['start']>[0]) =>
      controller.start(request),
    results: () => journal.history,
  },
});

const rootElement = document.getElementById('app');

if (rootElement) {
  createRoot(rootElement).render(
    <App controller={controller} journal={journal} />,
  );
}
