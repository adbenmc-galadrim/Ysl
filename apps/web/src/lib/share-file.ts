export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

type ShareHost = {
  navigator: Pick<Navigator, 'share'> & { canShare?: Navigator['canShare'] };
  document: Pick<Document, 'createElement' | 'body'>;
  URL: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
};

/**
 * Hands a file to the user: the share sheet when the browser offers one for
 * files (iOS, where Fichiers, AirDrop and Mail then take it), a download
 * otherwise. Closing the sheet is not an error.
 */
export async function shareFile(
  file: File,
  title: string,
  host: ShareHost = { navigator, document, URL },
): Promise<ShareOutcome> {
  if (host.navigator.canShare?.({ files: [file] })) {
    try {
      await host.navigator.share({ files: [file], title });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return 'cancelled';
      }
      throw error;
    }
  }
  const url = host.URL.createObjectURL(file);
  const anchor = host.document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  host.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  host.URL.revokeObjectURL(url);
  return 'downloaded';
}
