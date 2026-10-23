export type StreamLog = (name: string, detail?: string) => void;

const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 4032 },
    height: { ideal: 3024 },
  },
};

function describe(track: MediaStreamTrack | undefined): string {
  const settings = track?.getSettings();
  if (!settings) return 'aucune piste';
  return `${settings.width}×${settings.height} @ ${settings.frameRate} i/s`;
}

export class CameraStream {
  private stream: MediaStream | undefined;
  private opening: Promise<void> | undefined;

  constructor(private readonly log: StreamLog) {}

  get track(): MediaStreamTrack | undefined {
    return this.stream?.getVideoTracks()[0];
  }

  get live(): boolean {
    return this.track?.readyState === 'live';
  }

  start(video: HTMLVideoElement): Promise<void> {
    this.opening ??= this.open(video).finally(() => {
      this.opening = undefined;
    });
    return this.opening;
  }

  async resume(video: HTMLVideoElement): Promise<void> {
    if (!this.stream) return;
    if (!this.live) {
      this.log('stream-dead', this.track?.readyState);
      await this.start(video);
      return;
    }
    if (video.paused) {
      await video.play();
      this.log('video-replayed');
    }
  }

  private async open(video: HTMLVideoElement): Promise<void> {
    const restarting = this.stream !== undefined;
    const stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
    this.stream = stream;
    const track = stream.getVideoTracks()[0];
    track?.addEventListener('mute', () => this.log('track-muted'));
    track?.addEventListener('unmute', () => this.log('track-unmuted'));
    track?.addEventListener('ended', () => {
      this.log('track-ended');
      if (document.visibilityState !== 'visible') return;
      this.start(video).catch((error: unknown) =>
        this.log('restart-failed', String(error)),
      );
    });
    video.srcObject = stream;
    await video.play();
    this.log(
      restarting ? 'stream-restarted' : 'stream-started',
      describe(track),
    );
  }
}
