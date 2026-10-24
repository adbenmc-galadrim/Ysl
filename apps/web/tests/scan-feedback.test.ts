import { describe, expect, it, vi } from 'vitest';
import {
  type BeepContext,
  confirmsReading,
  feedbackFor,
  ScanFeedback,
  VIBRATION_MS,
} from '#/features/scan/feedback';

type Fake = {
  context: BeepContext;
  resume: ReturnType<typeof vi.fn>;
  oscillators: { start: number; stop: number; frequency: number }[];
};

function fakeContext(state: BeepContext['state'] = 'running'): Fake {
  const oscillators: Fake['oscillators'] = [];
  const resume = vi.fn(() => {
    context.state = 'running';
    return Promise.resolve();
  });
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const context = {
    state,
    currentTime: 10,
    destination: { connect: vi.fn() },
    resume,
    createOscillator() {
      const record = { start: NaN, stop: NaN, frequency: 0 };
      oscillators.push(record);
      const frequency = param();
      return {
        type: 'sine' as OscillatorType,
        frequency,
        connect: vi.fn(),
        start: (at: number) => {
          record.start = at;
          record.frequency = frequency.value;
        },
        stop: (at: number) => void (record.stop = at),
      };
    },
    createGain() {
      return { gain: param(), connect: vi.fn() };
    },
  };
  return { context, resume, oscillators };
}

describe('feedbackFor', () => {
  it('beeps on the setting, vibrates on the phone', () => {
    expect(feedbackFor(true, true)).toEqual({ beep: true, vibrate: true });
    expect(feedbackFor(false, false)).toEqual({ beep: false, vibrate: false });
  });
});

describe('confirmsReading', () => {
  it('confirms a kept reading with at least one code', () => {
    expect(
      confirmsReading({ kept: true, failed: false, symbols: ['UPS'] }),
    ).toBe(true);
  });

  it.each([
    ['nothing read', { kept: true, failed: false, symbols: [] }],
    ['a failed shot', { kept: true, failed: true, symbols: ['UPS'] }],
    ['a draft not kept', { kept: false, failed: false, symbols: ['UPS'] }],
  ])('stays silent on %s', (_, reading) => {
    expect(confirmsReading(reading)).toBe(false);
  });
});

describe('ScanFeedback', () => {
  it('plays a short tone and vibrates when the phone can', () => {
    const fake = fakeContext();
    const vibrate = vi.fn(() => true);
    const feedback = new ScanFeedback({
      isSoundOn: () => true,
      createContext: () => fake.context,
      vibrate,
      claimAudioSession: () => undefined,
    });
    expect(feedback.confirm()).toEqual({ beep: true, vibrate: true });
    expect(fake.oscillators).toHaveLength(1);
    const [tone] = fake.oscillators;
    expect(tone?.frequency).toBe(1760);
    expect(tone?.start).toBe(10);
    expect(tone?.stop).toBeCloseTo(10.1, 5);
    expect(vibrate).toHaveBeenCalledWith(VIBRATION_MS);
  });

  it('keeps quiet when the sound is off, and still vibrates', () => {
    const fake = fakeContext();
    const vibrate = vi.fn(() => true);
    const feedback = new ScanFeedback({
      isSoundOn: () => false,
      createContext: () => fake.context,
      vibrate,
      claimAudioSession: () => undefined,
    });
    expect(feedback.confirm()).toEqual({ beep: false, vibrate: true });
    expect(fake.oscillators).toHaveLength(0);
    expect(vibrate).toHaveBeenCalledOnce();
  });

  it('never calls vibrate where the browser has none', () => {
    const fake = fakeContext();
    const feedback = new ScanFeedback({
      isSoundOn: () => true,
      createContext: () => fake.context,
      vibrate: undefined,
      claimAudioSession: () => undefined,
    });
    expect(feedback.canVibrate).toBe(false);
    expect(feedback.confirm().vibrate).toBe(false);
  });

  it('wakes a suspended context on unlock and claims the audio session', () => {
    const fake = fakeContext('suspended');
    const claim = vi.fn();
    const feedback = new ScanFeedback({
      isSoundOn: () => true,
      createContext: () => fake.context,
      vibrate: undefined,
      claimAudioSession: claim,
    });
    feedback.unlock();
    expect(fake.resume).toHaveBeenCalledOnce();
    expect(claim).toHaveBeenCalledWith(true);
    feedback.unlock();
    expect(fake.resume).toHaveBeenCalledOnce();
  });

  it('wakes an interrupted context before the beep', () => {
    const fake = fakeContext('interrupted');
    const feedback = new ScanFeedback({
      isSoundOn: () => true,
      createContext: () => fake.context,
      vibrate: undefined,
      claimAudioSession: () => undefined,
    });
    expect(feedback.confirm().beep).toBe(true);
    expect(fake.resume).toHaveBeenCalledOnce();
    expect(fake.oscillators).toHaveLength(1);
  });

  it('gives the audio session back on release', () => {
    const claim = vi.fn();
    const feedback = new ScanFeedback({
      isSoundOn: () => true,
      createContext: () => fakeContext().context,
      vibrate: undefined,
      claimAudioSession: claim,
    });
    feedback.unlock();
    feedback.release();
    expect(claim.mock.calls).toEqual([[true], [false]]);
  });

  it('gives the audio session back and leaves audio alone when the sound is off', () => {
    const create = vi.fn(() => fakeContext('suspended').context);
    const claim = vi.fn();
    const feedback = new ScanFeedback({
      isSoundOn: () => false,
      createContext: create,
      vibrate: undefined,
      claimAudioSession: claim,
    });
    feedback.unlock();
    expect(create).not.toHaveBeenCalled();
    expect(claim).toHaveBeenCalledWith(false);
  });

  it('reports no beep without Web Audio or when the context fails', () => {
    const none = new ScanFeedback({
      isSoundOn: () => true,
      createContext: () => undefined,
      vibrate: undefined,
      claimAudioSession: () => undefined,
    });
    expect(none.confirm()).toEqual({ beep: false, vibrate: false });
    const broken = new ScanFeedback({
      isSoundOn: () => true,
      createContext: () => {
        throw new Error('no audio');
      },
      vibrate: () => {
        throw new Error('no vibration');
      },
      claimAudioSession: () => undefined,
    });
    expect(broken.confirm()).toEqual({ beep: false, vibrate: false });
  });
});
