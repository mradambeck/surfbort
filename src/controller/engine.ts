import WaveSurfer, { type WaveSurferOptions } from "wavesurfer.js";
import type { ImageSource, LoadStatus, PlaylistCallbacks, Track, WaveformOptions } from "../types";
import { COLOR_PROPERTIES, readWaveformColors, type ColorOption } from "../utils/cssColors";
import { isAbortError, normalizeImage, trackKey } from "../utils/tracks";
import { joinExclusive, pauseOthers } from "./exclusive";
import * as mediaSession from "./mediaSession";
import { createValueStore } from "./store";

/** Once playback passes this point, Previous restarts the track instead of going back one. */
const RESTART_THRESHOLD = 3;

/** How many tracks preloadDurations() fetches metadata for at once. */
const PRELOAD_CONCURRENCY = 3;

const COLOR_OPTIONS = Object.keys(COLOR_PROPERTIES) as ColorOption[];

export const WAVEFORM_DEFAULTS: Partial<WaveSurferOptions> = {
  height: "auto",
  barWidth: 2,
  barGap: 2,
  barRadius: 2,
  cursorWidth: 2,
  normalize: true,
  dragToSeek: true,
  hideScrollbar: true,
  // Used until the stylesheet's color variables can be read.
  waveColor: "rgb(128 128 128 / 0.5)",
  progressColor: "#0b6f6a",
  cursorColor: "#0b6f6a",
};

export interface EngineState {
  tracks: readonly Track[];
  index: number;
  /** True from the moment playback is requested until it pauses or stops, including while a track loads. */
  isPlaying: boolean;
  status: LoadStatus;
  duration: number;
  error: Error | null;
  volume: number;
  muted: boolean;
  /** Per-track lengths: the track's own `duration`, or one measured after loading. */
  durations: ReadonlyArray<number | undefined>;
}

export interface EngineConfig {
  autoAdvance: boolean;
  loop: boolean;
  exclusive: boolean;
  mediaSession: boolean;
  waveformOptions?: WaveformOptions;
}

export interface MediaInfo {
  album?: string;
  artwork?: ImageSource;
}

/**
 * Owns one wavesurfer.js instance and the playlist's playback state. React reads the
 * state through subscribe/getSnapshot; everything else goes through the public methods.
 */
export class PlaylistEngine implements mediaSession.MediaSessionClient {
  readonly time = createValueStore(0);
  readonly loadProgress = createValueStore(0);

  private state: EngineState;
  private config: EngineConfig;
  private callbacks: PlaylistCallbacks = {};
  private album: string | undefined;
  private artworkSrc: string | undefined;
  private readonly listeners = new Set<() => void>();
  private readonly knownDurations = new Map<string, number>();

  private ws: WaveSurfer | null = null;
  private container: HTMLElement | null = null;
  private fallbackContainer: HTMLElement | null = null;
  private teardown: Array<() => void> = [];
  private leaveExclusive: (() => void) | null = null;
  /** Set while wavesurfer loads a track, so the pause it makes on the old one isn't read as the listener's. */
  private loading = false;
  private loadedSrc: string | null = null;
  /** The latest position asked for by seek(), until the media reaches it. */
  private seekTarget: number | null = null;
  /** The target last handed to the media. */
  private seekInFlight: number | null = null;

  constructor(tracks: readonly Track[], initialTrack: number, config: EngineConfig) {
    const index = tracks.length ? Math.min(Math.max(Math.trunc(initialTrack) || 0, 0), tracks.length - 1) : 0;
    this.config = config;
    this.state = {
      tracks,
      index,
      isPlaying: false,
      status: "idle",
      duration: tracks[index]?.duration ?? 0,
      error: null,
      volume: 1,
      muted: false,
      durations: tracks.map((track) => track.duration),
    };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): EngineState => this.state;
  getWaveSurfer = (): WaveSurfer | null => this.ws;
  getCurrentTime = (): number => this.time.get();

  setCallbacks(callbacks: PlaylistCallbacks): void {
    this.callbacks = callbacks;
  }

  setMediaInfo(info: MediaInfo): void {
    const artworkSrc = info.artwork ? normalizeImage(info.artwork).src : undefined;
    if (info.album === this.album && artworkSrc === this.artworkSrc) return;
    this.album = info.album;
    this.artworkSrc = artworkSrc;
    this.syncMediaMetadata();
  }

  setConfig(config: EngineConfig): void {
    const previous = this.config;
    this.config = config;
    if (this.ws && config.exclusive !== previous.exclusive) {
      this.leaveExclusive?.();
      this.leaveExclusive = config.exclusive ? joinExclusive(this) : null;
    }
    if (previous.mediaSession && !config.mediaSession) mediaSession.release(this);
    if (this.ws && config.waveformOptions !== previous.waveformOptions) {
      const changed = changedOptions(previous.waveformOptions, config.waveformOptions);
      if (!Object.keys(changed).length) return;
      this.ws.setOptions(changed);
      // Dropping a color override hands that color back to the stylesheet.
      if (COLOR_OPTIONS.some((option) => option in changed)) this.refreshColors();
    }
  }

  setTracks(tracks: readonly Track[]): void {
    const { tracks: previous, index } = this.state;
    if (tracks === previous) return;
    const durations = this.durationsFor(tracks);

    if (!tracks.length) {
      this.loading = false;
      this.loadedSrc = null;
      this.clearSeek();
      this.ws?.pause();
      this.ws?.empty();
      this.time.set(0);
      this.update({ tracks, index: 0, isPlaying: false, status: "idle", duration: 0, error: null, durations });
      return;
    }

    const current = previous[index];
    const kept = current ? tracks.findIndex((track) => trackKey(track) === trackKey(current)) : -1;
    if (kept !== -1) {
      this.update({ tracks, index: kept, durations });
      // Same id, different file.
      if (this.ws && tracks[kept]!.src !== this.loadedSrc) this.loadCurrent();
      return;
    }

    const nextIndex = Math.min(index, tracks.length - 1);
    this.update({ tracks, index: nextIndex, isPlaying: false, durations });
    this.loadCurrent();
    this.callbacks.onTrackChange?.(tracks[nextIndex]!, nextIndex);
  }

  mount(): void {
    if (this.ws || typeof document === "undefined") return;
    const container = this.container ?? this.getFallbackContainer();
    const { plugins, ...options } = this.config.waveformOptions ?? {};
    const ws = WaveSurfer.create({
      ...WAVEFORM_DEFAULTS,
      ...this.cssColors(container),
      ...options,
      plugins,
      container,
    });
    this.ws = ws;
    ws.setVolume(this.state.volume);
    ws.setMuted(this.state.muted);

    this.teardown = [
      ws.on("loading", (percent) => this.loadProgress.set(percent)),
      ws.on("ready", this.handleReady),
      ws.on("play", this.handlePlay),
      ws.on("pause", this.handlePause),
      ws.on("finish", this.handleFinish),
      ws.on("timeupdate", this.handleTimeUpdate),
      ws.on("seeking", this.syncPosition),
      ws.on("interaction", this.handleInteraction),
      ws.on("error", this.handleError),
    ];
    const media = ws.getMediaElement();
    if (media) {
      media.addEventListener("seeked", this.handleSeeked);
      this.teardown.push(() => media.removeEventListener("seeked", this.handleSeeked));
    }
    if (this.config.exclusive) this.leaveExclusive = joinExclusive(this);
    if (typeof window.matchMedia === "function") {
      const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
      colorScheme.addEventListener("change", this.refreshColors);
      this.teardown.push(() => colorScheme.removeEventListener("change", this.refreshColors));
    }

    this.callbacks.onInit?.(ws);
    this.loadCurrent();
  }

  unmount(): void {
    for (const off of this.teardown) off();
    this.teardown = [];
    this.leaveExclusive?.();
    this.leaveExclusive = null;
    mediaSession.release(this);
    this.ws?.destroy();
    this.ws = null;
    this.loading = false;
    this.loadedSrc = null;
    // Keep the selection in case this is StrictMode remounting. Playback ends with the instance.
    if (this.state.isPlaying || this.state.status !== "idle") this.update({ isPlaying: false, status: "idle" });
  }

  /** Called by <Waveform> with its mount point, and with null when it unmounts. */
  attachContainer = (el: HTMLElement | null): void => {
    if (el === this.container) return;
    this.container = el;
    if (!this.ws) return;
    this.ws.setOptions({ container: el ?? this.getFallbackContainer() });
    if (el) this.refreshColors();
  };

  refreshColors = (): void => {
    const ws = this.ws;
    const el = this.container;
    if (!ws || !el) return;
    const colors = this.cssColors(el);
    const changed: Partial<WaveSurferOptions> = {};
    for (const option of COLOR_OPTIONS) {
      const color = colors[option];
      if (color && ws.options[option] !== color) changed[option] = color;
    }
    if (Object.keys(changed).length) ws.setOptions(changed);
  };

  play = (): void => {
    if (!this.currentTrack()) return;
    if (!this.state.isPlaying) this.update({ isPlaying: true });
    if (this.state.status === "ready") this.startPlayback();
    else if (this.state.status === "error") this.loadCurrent();
    // Otherwise the track is still loading, and handleReady starts it.
  };

  pause = (): void => {
    if (this.state.isPlaying) this.update({ isPlaying: false });
    this.ws?.pause();
  };

  toggle = (): void => {
    if (this.state.isPlaying) this.pause();
    else this.play();
  };

  playTrack = (index: number): void => this.goTo(index, true);
  selectTrack = (index: number): void => this.goTo(index, false);

  next = (): void => {
    const nextIndex = this.nextIndex();
    if (nextIndex !== null) this.goTo(nextIndex, this.state.isPlaying);
  };

  previous = (): void => {
    const { index, tracks, isPlaying } = this.state;
    if (!tracks.length) return;
    if (this.time.get() > RESTART_THRESHOLD || (index === 0 && !this.config.loop)) {
      this.seek(0);
      return;
    }
    this.goTo(index > 0 ? index - 1 : tracks.length - 1, isPlaying);
  };

  seek = (seconds: number): void => {
    const { duration } = this.state;
    if (!this.ws || !(duration > 0)) return;
    const time = Math.min(Math.max(seconds, 0), duration);
    this.seekTarget = time;
    this.time.set(time);
    this.applySeek();
    this.syncPosition();
  };

  seekBy = (seconds: number): void => this.seek(this.time.get() + seconds);

  setVolume = (volume: number): void => {
    const level = Math.min(Math.max(volume, 0), 1);
    // Raising the volume while muted unmutes, the way OS volume controls behave.
    const unmute = this.state.muted && level > 0;
    this.ws?.setVolume(level);
    if (unmute) this.ws?.setMuted(false);
    this.update({ volume: level, muted: unmute ? false : this.state.muted });
  };

  setMuted = (muted: boolean): void => {
    this.ws?.setMuted(muted);
    this.update({ muted });
  };

  /** Fetches metadata for tracks with no known length. Returns a function that cancels it. */
  preloadDurations(): () => void {
    if (typeof Audio === "undefined") return () => {};
    const queue = this.state.tracks.filter(
      (track) => track.duration == null && !this.knownDurations.has(trackKey(track)),
    );
    const active = new Set<HTMLAudioElement>();
    let cancelled = false;

    const release = (audio: HTMLAudioElement) => {
      active.delete(audio);
      // Dropping the source stops the request.
      audio.removeAttribute("src");
      audio.load();
    };

    const startNext = () => {
      while (!cancelled && active.size < PRELOAD_CONCURRENCY && queue.length) {
        const track = queue.shift()!;
        const audio = new Audio();
        audio.preload = "metadata";
        active.add(audio);
        const settle = () => {
          if (Number.isFinite(audio.duration) && audio.duration > 0) this.recordDuration(track, audio.duration);
          release(audio);
          startNext();
        };
        audio.addEventListener("loadedmetadata", settle, { once: true });
        audio.addEventListener("error", settle, { once: true });
        audio.src = track.src;
      }
    };

    startNext();
    return () => {
      cancelled = true;
      for (const audio of [...active]) release(audio);
    };
  }

  private update(patch: Partial<EngineState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private currentTrack(): Track | undefined {
    return this.state.tracks[this.state.index];
  }

  private nextIndex(): number | null {
    const { index, tracks } = this.state;
    if (index + 1 < tracks.length) return index + 1;
    return this.config.loop && tracks.length > 0 ? 0 : null;
  }

  private goTo(index: number, play: boolean): void {
    const track = this.state.tracks[index];
    if (!track) return;
    if (index === this.state.index) {
      if (play) this.play();
      return;
    }
    this.update({ index, isPlaying: play });
    this.loadCurrent();
    this.callbacks.onTrackChange?.(track, index);
  }

  /**
   * Hands the latest seek target to the media, one seek at a time. In wavesurfer.js 8.0.3,
   * a seek made while another is in progress gets deferred and then discarded when the
   * earlier seek's `seeking` event arrives, which drops seeks from a held arrow key or
   * OS scrubbing. handleSeeked sends whatever target is waiting once a seek lands.
   */
  private applySeek(): void {
    const ws = this.ws;
    const target = this.seekTarget;
    if (!ws || target === null) return;
    const media = ws.getMediaElement();
    if (!media) {
      // The WebAudio backend seeks synchronously.
      ws.setTime(target);
      this.seekTarget = null;
      return;
    }
    if (media.seeking) return;
    this.seekInFlight = target;
    ws.setTime(target);
  }

  private clearSeek(): void {
    this.seekTarget = null;
    this.seekInFlight = null;
  }

  private loadCurrent(): void {
    const track = this.currentTrack();
    if (!track) return;
    this.clearSeek();
    this.time.set(0);
    this.loadProgress.set(0);
    this.update({
      status: "loading",
      error: null,
      duration: track.duration ?? this.knownDurations.get(trackKey(track)) ?? 0,
    });
    this.syncMediaMetadata();
    const ws = this.ws;
    // Before mount there's no instance yet. mount() loads the current track.
    if (!ws) return;
    this.loading = true;
    this.loadedSrc = track.src;
    ws.load(track.src, track.peaks, track.duration).catch(() => {
      // A superseded load rejects with AbortError, which is routine. Real failures
      // also arrive through the `error` event, where handleError reports them.
    });
  }

  private startPlayback(): void {
    const ws = this.ws;
    if (!ws) return;
    ws.play().catch((error: unknown) => {
      // A newer load or a pause interrupting play() is routine. Anything else, usually
      // the autoplay policy, means playback isn't going to start, so drop the request.
      if (isAbortError(error) || this.ws !== ws) return;
      if (this.state.isPlaying && !ws.isPlaying()) this.update({ isPlaying: false });
    });
  }

  private handleReady = (duration: number): void => {
    const track = this.currentTrack();
    // wavesurfer's empty() loads silence, which needs no handling.
    if (!track) return;
    this.loading = false;
    this.loadProgress.set(100);
    if (Number.isFinite(duration) && duration > 0) this.knownDurations.set(trackKey(track), duration);
    this.update({ status: "ready", duration, error: null, durations: this.durationsFor(this.state.tracks) });
    this.refreshColors();
    this.syncPosition();
    if (this.state.isPlaying) this.startPlayback();
  };

  private handleTimeUpdate = (time: number): void => {
    // The outgoing track can still report its position while the next one loads, and
    // media that's seeking reports where it was until the seek lands.
    if (!this.loading && this.seekTarget === null) this.time.set(time);
  };

  private handleSeeked = (): void => {
    if (this.seekTarget === null) return;
    if (this.seekTarget === this.seekInFlight) this.clearSeek();
    else this.applySeek();
  };

  /** A click or drag on the waveform wins over any keyboard seek still in progress. */
  private handleInteraction = (time: number): void => {
    this.clearSeek();
    this.time.set(time);
  };

  private handlePlay = (): void => {
    if (this.config.exclusive) pauseOthers(this);
    if (this.config.mediaSession) {
      mediaSession.claim(this);
      this.syncMediaMetadata();
      mediaSession.setPlaybackState(this, "playing");
      this.syncPosition();
    }
    if (!this.state.isPlaying) this.update({ isPlaying: true });
    const track = this.currentTrack();
    if (track) this.callbacks.onPlay?.(track, this.state.index);
  };

  private handlePause = (): void => {
    const ws = this.ws;
    // Skip the pause wavesurfer makes while switching tracks, a stale one that lands after
    // the next play() call, and the one that comes right before `finish`.
    if (!ws || this.loading || ws.isPlaying() || ws.getMediaElement()?.ended) return;
    mediaSession.setPlaybackState(this, "paused");
    this.syncPosition();
    if (this.state.isPlaying) this.update({ isPlaying: false });
    const track = this.currentTrack();
    if (track) this.callbacks.onPause?.(track, this.state.index);
  };

  private handleFinish = (): void => {
    const { index, tracks } = this.state;
    const track = tracks[index];
    if (track) this.callbacks.onTrackEnd?.(track, index);
    const nextIndex = this.nextIndex();
    if (this.config.autoAdvance && nextIndex !== null) {
      // A one-track loop restarts in place.
      if (nextIndex === index) this.startPlayback();
      else this.goTo(nextIndex, true);
      return;
    }
    this.update({ isPlaying: false });
    mediaSession.setPlaybackState(this, "paused");
    if (nextIndex === null) this.callbacks.onPlaylistEnd?.();
  };

  private handleError = (error: Error): void => {
    this.loading = false;
    this.clearSeek();
    this.update({ status: "error", error, isPlaying: false });
    mediaSession.setPlaybackState(this, "paused");
    const track = this.currentTrack();
    if (track) this.callbacks.onError?.(error, track, this.state.index);
  };

  private syncPosition = (): void => {
    mediaSession.setPosition(this, this.state.duration, this.time.get());
  };

  private syncMediaMetadata(): void {
    const track = this.currentTrack();
    if (!track || !mediaSession.isOwner(this)) return;
    mediaSession.setMetadata(this, {
      title: track.title,
      artist: track.artist,
      album: this.album,
      artwork: track.artwork ? normalizeImage(track.artwork).src : this.artworkSrc,
    });
  }

  private recordDuration(track: Track, duration: number): void {
    this.knownDurations.set(trackKey(track), duration);
    this.update({ durations: this.durationsFor(this.state.tracks) });
  }

  private durationsFor(tracks: readonly Track[]): Array<number | undefined> {
    return tracks.map((track) => track.duration ?? this.knownDurations.get(trackKey(track)));
  }

  /** Colors from the stylesheet, minus any the caller set in waveformOptions. */
  private cssColors(el: HTMLElement): Partial<Record<ColorOption, string>> {
    if (el === this.fallbackContainer || !el.isConnected) return {};
    const overrides = this.config.waveformOptions ?? {};
    const colors = readWaveformColors(el);
    for (const option of COLOR_OPTIONS) {
      if (overrides[option] !== undefined) delete colors[option];
    }
    return colors;
  }

  private getFallbackContainer(): HTMLElement {
    this.fallbackContainer ??= document.createElement("div");
    return this.fallbackContainer;
  }
}

function changedOptions(previous: WaveformOptions = {}, next: WaveformOptions = {}): Partial<WaveSurferOptions> {
  const changed: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]) as Set<keyof WaveformOptions>;
  for (const key of keys) {
    // Plugins are only read when the instance is created.
    if (key === "plugins" || Object.is(previous[key], next[key])) continue;
    changed[key] = next[key] ?? WAVEFORM_DEFAULTS[key];
  }
  return changed as Partial<WaveSurferOptions>;
}
