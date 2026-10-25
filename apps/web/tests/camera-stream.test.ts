import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraStream } from '#/features/camera/stream';

type FakeTrack = {
  readyState: 'live' | 'ended';
  stop: () => void;
  addEventListener: () => void;
};

const tracks: FakeTrack[] = [];
let visibility: 'visible' | 'hidden' = 'visible';
let pageListeners = new EventTarget();
const getUserMedia = vi.fn(() => {
  const track: FakeTrack = {
    readyState: 'live',
    stop: () => {
      track.readyState = 'ended';
    },
    addEventListener: () => undefined,
  };
  tracks.push(track);
  return Promise.resolve({
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream);
});

const video = () =>
  ({
    srcObject: null,
    paused: true,
    play: vi.fn(() => Promise.resolve()),
  }) as unknown as HTMLVideoElement;

const fire = (type: string) => pageListeners.dispatchEvent(new Event(type));

const hide = () => {
  visibility = 'hidden';
  fire('visibilitychange');
};

const show = () => {
  visibility = 'visible';
  fire('visibilitychange');
};

beforeEach(() => {
  vi.useFakeTimers();
  pageListeners = new EventTarget();
  tracks.length = 0;
  visibility = 'visible';
  getUserMedia.mockClear();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('document', {
    get visibilityState() {
      return visibility;
    },
    addEventListener: (type: string, listener: EventListener) =>
      pageListeners.addEventListener(type, listener),
  });
  vi.stubGlobal('window', {
    addEventListener: (type: string, listener: EventListener) =>
      pageListeners.addEventListener(type, listener),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('CameraStream', () => {
  it('stops the camera once the viewfinder leaves the screen', async () => {
    const camera = new CameraStream();
    const viewfinder = video();
    await camera.attach(viewfinder);
    expect(camera.state).toBe('live');

    camera.detach(viewfinder);
    expect(tracks[0]?.readyState).toBe('live');
    vi.runAllTimers();

    expect(tracks[0]?.readyState).toBe('ended');
    expect(camera.state).toBe('idle');
    expect(viewfinder.srcObject).toBeNull();
  });

  it('opens it again when the viewfinder comes back', async () => {
    const camera = new CameraStream();
    const first = video();
    await camera.attach(first);
    camera.detach(first);
    vi.runAllTimers();

    await camera.attach(video());

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(camera.state).toBe('live');
  });

  it('keeps the stream for a viewfinder that remounts at once', async () => {
    const camera = new CameraStream();
    const first = video();
    await camera.attach(first);
    camera.detach(first);
    await camera.attach(video());
    vi.runAllTimers();

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(tracks[0]?.readyState).toBe('live');
  });

  it('keeps filming behind the app, where a new stream would ask again', async () => {
    const camera = new CameraStream();
    await camera.attach(video());

    hide();
    show();

    expect(tracks[0]?.readyState).toBe('live');
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('stops when the page is unloaded', async () => {
    const camera = new CameraStream();
    await camera.attach(video());

    fire('pagehide');

    expect(tracks[0]?.readyState).toBe('ended');
    expect(camera.state).toBe('idle');
  });

  it('drops a stream granted after the viewfinder left', async () => {
    const camera = new CameraStream();
    const viewfinder = video();
    const opening = camera.attach(viewfinder);
    camera.detach(viewfinder);
    vi.runAllTimers();
    await opening;

    expect(tracks[0]?.readyState).toBe('ended');
    expect(camera.state).toBe('idle');
  });

  it('stays off when the viewfinder leaves while the video starts', async () => {
    const camera = new CameraStream();
    let started = () => undefined as void;
    const play = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          started = resolve;
        }),
    );
    const viewfinder = {
      srcObject: null,
      paused: true,
      play,
    } as unknown as HTMLVideoElement;
    const opening = camera.attach(viewfinder);
    await vi.waitFor(() => expect(play).toHaveBeenCalled());
    camera.detach(viewfinder);
    vi.runAllTimers();
    started();
    await opening;

    expect(tracks[0]?.readyState).toBe('ended');
    expect(camera.state).toBe('idle');
  });

  it('opens again on return when iOS ended the stream behind the app', async () => {
    const camera = new CameraStream();
    await camera.attach(video());
    hide();
    tracks[0]?.stop();

    show();

    await vi.waitFor(() => expect(camera.state).toBe('live'));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('stays off in the foreground without a viewfinder', async () => {
    const camera = new CameraStream();
    const viewfinder = video();
    await camera.attach(viewfinder);
    camera.detach(viewfinder);
    vi.runAllTimers();

    hide();
    show();

    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});
