const QR_URL = 'qr-retrait.png';

export async function loadQrFile(): Promise<File> {
  const response = await fetch(QR_URL);
  if (!response.ok) throw new Error(`QR introuvable (${response.status})`);
  return new File([await response.blob()], 'qr-retrait-4821.png', {
    type: 'image/png',
  });
}

export function canShareFile(file: File): boolean {
  return navigator.canShare?.({ files: [file] }) === true;
}

export async function shareWithQr(
  file: File,
  title: string,
  text: string,
): Promise<string> {
  if (!canShareFile(file)) return 'partage de fichiers indisponible';
  try {
    await navigator.share({ title, text, files: [file] });
    return 'partagé';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'annulé';
    }
    return error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);
  }
}
