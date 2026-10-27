/** Resolves once the app is in front again: the agent is back from the mail app. */
export function whenVisible(): Promise<void> {
  return new Promise((resolve) => {
    if (document.visibilityState === 'visible') {
      resolve();
      return;
    }
    const onChange = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', onChange);
      resolve();
    };
    document.addEventListener('visibilitychange', onChange);
  });
}
