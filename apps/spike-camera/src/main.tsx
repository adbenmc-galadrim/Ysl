import { createRoot } from 'react-dom/client';
import { App } from '#/app';
import { CameraStream } from '#/camera/stream';
import { readDevice } from '#/device';
import { Journal } from '#/metrics/journal';
import '#/styles.css';

const journal = new Journal(localStorage, readDevice());
const camera = new CameraStream((name, detail) => journal.log(name, detail));

const rootElement = document.getElementById('app');

if (rootElement) {
  createRoot(rootElement).render(<App journal={journal} camera={camera} />);
}
