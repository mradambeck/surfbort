import { vi } from "vitest";
import type { WaveSurferOptions } from "wavesurfer.js";

type Listener = (...args: never[]) => void;

interface PendingLoad {
  url: string;
  peaks: unknown;
  duration: number | undefined;
  resolve: () => void;
  reject: (error: unknown) => void;
  settled: boolean;
}

/**
 * Stands in for wavesurfer.js. Events fire synchronously, and tests decide when a load
 * finishes or fails, when playback reaches the end, and whether play() is refused.
 */
export class FakeWaveSurfer {
  static instances: FakeWaveSurfer[] = [];

  static create = vi.fn((options: WaveSurferOptions) => {
    const ws = new FakeWaveSurfer(options);
    FakeWaveSurfer.instances.push(ws);
    return ws;
  });

  static reset(): void {
    FakeWaveSurfer.instances = [];
    FakeWaveSurfer.create.mockClear();
  }

  static get live(): FakeWaveSurfer[] {
    return FakeWaveSurfer.instances.filter((ws) => !ws.destroyed);
  }

  /** The most recently created instance that hasn't been destroyed. */
  static latest(): FakeWaveSurfer {
    const ws = FakeWaveSurfer.live.at(-1);
    if (!ws) throw new Error("No live FakeWaveSurfer");
    return ws;
  }

  options: Record<string, unknown>;
  destroyed = false;
  playing = false;
  currentTime = 0;
  duration = 0;
  readonly loads: PendingLoad[] = [];
  readonly media = Object.assign(new EventTarget(), { ended: false, seeking: false });
  /** When set, the next play() call rejects with this error instead of playing. */
  refuseNextPlay: Error | null = null;
  /** When true, seeks stay in progress until finishSeek(), like a real media element. */
  holdSeeks = false;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(options: WaveSurferOptions) {
    this.options = { ...options };
  }

  on(event: string, listener: Listener): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(listener);
    return () => this.un(event, listener);
  }

  un(event: string, listener: Listener): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of [...(this.listeners.get(event) ?? [])]) (listener as (...a: unknown[]) => void)(...args);
  }

  load = vi.fn((url: string, peaks?: unknown, duration?: number): Promise<void> => {
    if (this.destroyed) return Promise.reject(new Error("Cannot load audio: wavesurfer was destroyed."));
    const previous = this.pendingLoad();
    if (previous) {
      previous.settled = true;
      previous.reject(new DOMException("Superseded by a newer load", "AbortError"));
    }
    // wavesurfer pauses the outgoing track when a new one starts loading.
    if (this.playing) {
      this.playing = false;
      this.emit("pause");
    }
    this.currentTime = 0;
    this.media.ended = false;
    return new Promise<void>((resolve, reject) => {
      this.loads.push({ url, peaks, duration, resolve, reject, settled: false });
    });
  });

  pendingLoad(): PendingLoad | undefined {
    const last = this.loads.at(-1);
    return last && !last.settled ? last : undefined;
  }

  /** Completes the latest load the way wavesurfer does: decode, ready, then the promise resolves. */
  finishLoad(duration = 180): void {
    const load = this.pendingLoad();
    if (!load) throw new Error("No pending load");
    this.duration = load.duration ?? duration;
    this.emit("decode", this.duration);
    this.emit("ready", this.duration);
    load.settled = true;
    load.resolve();
  }

  failLoad(error = new Error("Failed to fetch")): void {
    const load = this.pendingLoad();
    if (!load) throw new Error("No pending load");
    this.emit("error", error);
    load.settled = true;
    load.reject(error);
  }

  play = vi.fn((): Promise<void> => {
    if (this.refuseNextPlay) {
      const error = this.refuseNextPlay;
      this.refuseNextPlay = null;
      return Promise.reject(error);
    }
    this.playing = true;
    this.media.ended = false;
    this.emit("play");
    return Promise.resolve();
  });

  pause = vi.fn((): void => {
    if (!this.playing) return;
    this.playing = false;
    this.emit("pause");
  });

  isPlaying(): boolean {
    return this.playing;
  }

  setTime = vi.fn((time: number): void => {
    this.currentTime = time;
    this.emit("timeupdate", time);
    if (this.holdSeeks) this.media.seeking = true;
    else this.media.dispatchEvent(new Event("seeked"));
  });

  finishSeek(): void {
    this.media.seeking = false;
    this.media.dispatchEvent(new Event("seeked"));
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getDuration(): number {
    return this.duration;
  }

  getMediaElement(): EventTarget & { ended: boolean; seeking: boolean } {
    return this.media;
  }

  setVolume = vi.fn();
  setMuted = vi.fn();
  empty = vi.fn();

  setOptions = vi.fn((options: Partial<WaveSurferOptions>): void => {
    Object.assign(this.options, options);
  });

  destroy = vi.fn((): void => {
    this.destroyed = true;
    this.emit("destroy");
    this.listeners.clear();
  });

  /** Moves the playhead the way playback would. */
  advance(time: number): void {
    this.currentTime = time;
    this.emit("timeupdate", time);
  }

  /** Plays to the end: the media pauses with `ended` set, then wavesurfer emits finish. */
  end(): void {
    this.currentTime = this.duration;
    this.playing = false;
    this.media.ended = true;
    this.emit("pause");
    this.emit("timeupdate", this.duration);
    this.emit("finish");
  }
}
