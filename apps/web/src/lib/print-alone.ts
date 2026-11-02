/**
 * In a frame of its own: printing narrows the window, which swaps the computer's
 * layout for the phone's and takes the page away from under the printer.
 */
export function printAlone(element: HTMLElement, title: string, css: string) {
  const frame = document.createElement('iframe');
  frame.title = title;
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
  const styles = [...document.querySelectorAll('link[rel=stylesheet], style')]
    .map((node) => node.outerHTML)
    .join('');
  frame.srcdoc = `<!doctype html><html><head><base href="${document.baseURI}">${styles}<style>${css}</style></head><body>${element.innerHTML}</body></html>`;
  frame.onload = () => {
    frame.contentWindow?.addEventListener('afterprint', () => frame.remove());
    frame.contentWindow?.print();
  };
  document.body.append(frame);
}
