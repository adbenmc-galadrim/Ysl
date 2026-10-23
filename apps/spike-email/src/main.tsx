import { createRoot } from 'react-dom/client';
import { App } from '#/app';
import { readDevice } from '#/device';
import { Journal } from '#/journal';
import { TemplateStore } from '#/templates/store';
import '#/styles.css';

const journal = new Journal(localStorage, readDevice());
const templates = new TemplateStore(localStorage);

const rootElement = document.getElementById('app');

if (rootElement) {
  createRoot(rootElement).render(
    <App journal={journal} templates={templates} />,
  );
}
