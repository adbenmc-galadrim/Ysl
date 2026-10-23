type ImageCaptureLike = { grabFrame(): Promise<ImageBitmap> };
type ImageCaptureConstructor = new (
  track: MediaStreamTrack,
) => ImageCaptureLike;

export type GrabSource = 'grabFrame' | 'video';

const imageCaptures = new WeakMap<MediaStreamTrack, ImageCaptureLike>();

const imageCaptureFor = (track: MediaStreamTrack) => {
  const ImageCapture = (
    globalThis as { ImageCapture?: ImageCaptureConstructor }
  ).ImageCapture;
  if (!ImageCapture) return undefined;
  let capture = imageCaptures.get(track);
  if (!capture) {
    capture = new ImageCapture(track);
    imageCaptures.set(track, capture);
  }
  return capture;
};

export const grab = async (
  video: HTMLVideoElement,
  track: MediaStreamTrack | undefined,
  onGrabFrameError: (error: unknown) => void,
): Promise<{ bitmap: ImageBitmap; source: GrabSource }> => {
  const capture = track && imageCaptureFor(track);
  if (capture) {
    try {
      return { bitmap: await capture.grabFrame(), source: 'grabFrame' };
    } catch (error) {
      onGrabFrameError(error);
    }
  }
  return { bitmap: await createImageBitmap(video), source: 'video' };
};
