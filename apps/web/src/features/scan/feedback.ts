import { scanSoundOn } from '#/features/settings/sound';

/** What a reading just taken earns: the beep follows the setting, the vibration the phone. The flash is the screen's, always. */
export type Feedback = { beep: boolean; vibrate: boolean };

export function feedbackFor(sound: boolean, canVibrate: boolean): Feedback {
  return { beep: sound, vibrate: canVibrate };
}

/** Only a tap that gave at least one code is confirmed: nothing read, a failed shot or a held duplicate stay silent. */
export function confirmsReading(reading: {
  kept: boolean;
  failed: boolean;
  symbols: readonly unknown[];
}): boolean {
  return reading.kept && !reading.failed && reading.symbols.length > 0;
}

/** How long the corners stay green and the veil shows, in ms. */
export const FLASH_MS = 600;
/** The v1 vibration, kept: short enough not to shake the shot that follows. */
export const VIBRATION_MS = 80;

const BEEP_HZ = 1760;
const BEEP_MS = 100;
const BEEP_GAIN = 0.3;

type BeepNode = { connect(target: BeepNode): unknown };
type BeepParam = {
  value: number;
  setValueAtTime(value: number, at: number): unknown;
  exponentialRampToValueAtTime(value: number, at: number): unknown;
};

/** The slice of Web Audio the beep needs, so a test can hand in a fake. */
export type BeepContext = {
  /** iOS also reports `interrupted` after a call or the lock screen. */
  state: AudioContextState | 'interrupted';
  currentTime: number;
  destination: BeepNode;
  resume(): Promise<void>;
  createOscillator(): BeepNode & {
    type: OscillatorType;
    frequency: BeepParam;
    start(at: number): void;
    stop(at: number): void;
  };
  createGain(): BeepNode & { gain: BeepParam };
};

type AudioSessionNavigator = Navigator & {
  audioSession?: { type: string };
};

export type ScanFeedbackOptions = {
  /** Whether the agent wants the beep; read at each confirmation. */
  isSoundOn?: () => boolean;
  /** Makes the context on the first gesture; `undefined` when the browser has none. */
  createContext?: () => BeepContext | undefined;
  /** `navigator.vibrate` where it exists; `undefined` on iOS, which has none. */
  vibrate?: ((ms: number) => boolean) | undefined;
  /** Asks iOS 17+ to let the beep through the silent switch, or gives that back; nothing elsewhere. */
  claimAudioSession?: (on: boolean) => void;
};

function defaultContext(): BeepContext | undefined {
  const Context =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext);
  return Context ? new Context() : undefined;
}

function defaultVibrate(): ((ms: number) => boolean) | undefined {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) {
    return undefined;
  }
  return (ms) => navigator.vibrate(ms);
}

function defaultClaimAudioSession(on: boolean) {
  if (typeof navigator === 'undefined') return;
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (session) session.type = on ? 'playback' : 'auto';
}

/**
 * The beep, the vibration and the flash of a label read. The agent looks at
 * the parcel, not the screen: the sound says it is taken. Web Audio only
 * plays after a gesture on iOS, so the page `unlock`s on the first touch of
 * the screen; the beep itself comes later, when the codes are back.
 */
export class ScanFeedback {
  private context: BeepContext | undefined;
  private readonly isSoundOn: () => boolean;
  private readonly createContext: () => BeepContext | undefined;
  private readonly vibrateFn: ((ms: number) => boolean) | undefined;
  private readonly claimAudioSession: (on: boolean) => void;

  constructor({
    isSoundOn = scanSoundOn,
    createContext = defaultContext,
    vibrate = defaultVibrate(),
    claimAudioSession = defaultClaimAudioSession,
  }: ScanFeedbackOptions = {}) {
    this.isSoundOn = isSoundOn;
    this.createContext = createContext;
    this.vibrateFn = vibrate;
    this.claimAudioSession = claimAudioSession;
  }

  get canVibrate(): boolean {
    return this.vibrateFn !== undefined;
  }

  /** From a user gesture: makes the context and wakes it, so the next beep is heard; with the sound off, only gives the audio session back. */
  unlock(): void {
    const on = this.isSoundOn();
    this.claimAudioSession(on);
    if (!on) return;
    const context = this.ensureContext();
    if (context) wake(context);
  }

  /** Leaving the screen: the audio session goes back to iOS, so other apps' sound is not held. */
  release(): void {
    this.claimAudioSession(false);
  }

  /** A label was read: what was actually played is returned, for a test or a diagnostic. */
  confirm(): Feedback {
    const feedback = feedbackFor(this.isSoundOn(), this.canVibrate);
    if (feedback.beep && !this.beep()) feedback.beep = false;
    if (feedback.vibrate) {
      try {
        this.vibrateFn?.(VIBRATION_MS);
      } catch {
        feedback.vibrate = false;
      }
    }
    return feedback;
  }

  private ensureContext(): BeepContext | undefined {
    try {
      this.context ??= this.createContext();
    } catch {
      this.context = undefined;
    }
    return this.context;
  }

  private beep(): boolean {
    const context = this.ensureContext();
    if (!context || context.state === 'closed') return false;
    wake(context);
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = context.currentTime;
      const end = at + BEEP_MS / 1000;
      oscillator.type = 'sine';
      oscillator.frequency.value = BEEP_HZ;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(BEEP_GAIN, at + 0.005);
      gain.gain.setValueAtTime(BEEP_GAIN, end - 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(end);
      return true;
    } catch {
      return false;
    }
  }
}

/** Anything but running (suspended, or interrupted on iOS) is asked to run again. */
function wake(context: BeepContext) {
  if (context.state !== 'running') void context.resume().catch(() => {});
}

let shared: ScanFeedback | undefined;

/** The app's one feedback player, made on first use like the decode queue. */
export function scanFeedback(): ScanFeedback {
  shared ??= new ScanFeedback();
  return shared;
}
