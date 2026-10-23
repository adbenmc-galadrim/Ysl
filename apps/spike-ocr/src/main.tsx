import { createRoot } from 'react-dom/client';
import { App } from '#/app';
import '#/styles.css';

const rootElement = document.getElementById('app');

if (rootElement) {
  createRoot(rootElement).render(<App />);
}
