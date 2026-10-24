import { BarcodeDecoder, type DecodeResult } from '@repo/barcode/worker';
import { useCallback, useEffect, useRef } from 'react';
import { readFile } from '#/features/scan/read-file';

export function useBarcodeDecoder(): (file: File) => Promise<DecodeResult> {
  const decoderRef = useRef<BarcodeDecoder | null>(null);

  useEffect(
    () => () => {
      decoderRef.current?.dispose();
      decoderRef.current = null;
    },
    [],
  );

  return useCallback((file: File) => {
    decoderRef.current ??= new BarcodeDecoder();
    return readFile(decoderRef.current, file);
  }, []);
}
