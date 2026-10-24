import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { ScanScreen, type ScanReading } from '@repo/ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useRef, useState, type ChangeEvent } from 'react';
import { useBarcodeDecoder } from '#/features/scan/use-barcode-decoder';
import { failedReading, toScanReading } from '#/features/scan/reading';

const t = createTranslator(DEFAULT_LOCALE);

export const Route = createFileRoute('/_authenticated/scan')({
  component: ScanPage,
});

function ScanPage() {
  const navigate = useNavigate();
  const close = () => void navigate({ to: '/' });
  const decode = useBarcodeDecoder();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState<ScanReading>({ kind: 'idle' });

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setReading({ kind: 'idle' });
    try {
      setReading(toScanReading(await decode(file), t));
    } catch {
      setReading(failedReading(t));
    }
  };

  return (
    <>
      <ScanScreen
        count={0}
        reading={reading}
        onClose={close}
        onDone={close}
        onImport={() => inputRef.current?.click()}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void onFile(event)}
      />
    </>
  );
}
