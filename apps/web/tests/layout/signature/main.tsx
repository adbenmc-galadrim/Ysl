import { SignatureScreen } from '@repo/ui';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { strokesToPng } from '#/features/handover/signature-png';
import { AppShell } from '#/features/shell/components/app-shell';
import '#/styles.css';

declare global {
  interface Window {
    /** What « Valider la signature » made: the PNG and its inked pixels. */
    __signature?: {
      bytes: number;
      width: number;
      height: number;
      inked: number;
    };
    __strokes?: string[];
  }
}

async function inkedPixels(blob: Blob): Promise<number> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(bitmap, 0, 0);
  const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
  let inked = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]! > 128) inked += 1;
  return inked;
}

/** The signature screen as the handover opens it, for the layout test. */
function Harness() {
  const [strokes, setStrokes] = useState<string[]>([]);
  window.__strokes = strokes;
  return (
    <SignatureScreen
      title="Nora Haddad signe pour 3 colis"
      strokes={strokes}
      onChange={setStrokes}
      onClear={() => setStrokes([])}
      onConfirm={() =>
        void strokesToPng(strokes).then(async ({ blob, width, height }) => {
          window.__signature = {
            bytes: blob.size,
            width,
            height,
            inked: await inkedPixels(blob),
          };
        })
      }
    />
  );
}

createRoot(document.getElementById('app')!).render(
  <AppShell>
    <Harness />
  </AppShell>,
);
