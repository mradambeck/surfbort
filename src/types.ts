import type { CSSProperties, ReactNode, Ref } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { WaveSurferOptions } from "wavesurfer.js";

/** An image URL, or a URL with alt text. Alt defaults to "" because the titles sit next to the art. */
export type ImageSource = string | { src: string; alt?: string };

/**
 * A static image or animated GIF. `stillSrc` replaces it for visitors who set
 * `prefers-reduced-motion: reduce`.
 */
export type BackgroundSource = string | { src: string; stillSrc?: string };

export interface Track {
  src: string;
  title: string;
  artist?: string;
  /** Keeps this track current when `tracks` is replaced or reordered. Defaults to `src`. */
  id?: string;
  /** Length in seconds, shown in the track list before the track has loaded. */
  duration?: number;
  /**
   * Precomputed waveform peaks, one array per channel. Together with `duration`, the
   * track streams instead of downloading in full before playback can start.
   */
  peaks?: Array<number[] | Float32Array>;
  /** Replaces the playlist artwork while this track is current. */
  artwork?: ImageSource;
  /** Replaces the playlist background while this track is current. */
  background?: BackgroundSource;
}

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export type Theme = "system" | "light" | "dark";

/** How much of the current track to fetch before it plays, like `<audio preload>`. */
export type Preload = "none" | "metadata" | "auto";

export type SlotName =
  | "root"
  | "player"
  | "artwork"
  | "panel"
  | "background"
  | "header"
  | "heading"
  | "title"
  | "nowPlaying"
  | "volume"
  | "muteButton"
  | "volumeSlider"
  | "transport"
  | "previousButton"
  | "playButton"
  | "nextButton"
  | "seek"
  | "waveform"
  | "time"
  | "trackList"
  | "track"
  | "trackNumber"
  | "trackButton"
  | "trackText"
  | "trackTitle"
  | "trackArtist"
  | "trackDuration"
  | "empty";

export type PlaylistClassNames = Partial<Record<SlotName, string>>;
export type PlaylistStyles = Partial<Record<SlotName, CSSProperties>>;

export interface PlaylistIcons {
  play: ReactNode;
  pause: ReactNode;
  previous: ReactNode;
  next: ReactNode;
  volume: ReactNode;
  muted: ReactNode;
  loading: ReactNode;
}

export interface PlaylistLabels {
  /** Names the player region when `title` isn't a plain string. */
  player: string;
  tracks: string;
  play: string;
  pause: string;
  previous: string;
  next: string;
  seek: string;
  volume: string;
  mute: string;
  unmute: string;
  playTrack: (track: Track) => string;
  pauseTrack: (track: Track) => string;
  /** The seek slider's spoken value, e.g. "1:05 of 3:20". */
  timeOf: (current: string, total: string) => string;
  loadError: string;
  empty: string;
}

export interface PlaylistControls {
  previous?: boolean;
  next?: boolean;
  time?: boolean;
  volume?: boolean;
}

/** wavesurfer.js options Surfbort passes through. The rest are managed per track. */
export type WaveformOptions = Partial<
  Omit<WaveSurferOptions, "container" | "url" | "peaks" | "duration" | "media" | "autoplay">
>;

export interface PlaylistHandle {
  play(): void;
  pause(): void;
  toggle(): void;
  /** Makes the track current and starts playing it. */
  playTrack(index: number): void;
  /** Makes the track current without starting playback. */
  selectTrack(index: number): void;
  next(): void;
  previous(): void;
  seek(seconds: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  /** Re-reads the waveform color variables, for themes that change CSS at runtime. */
  refreshWaveformColors(): void;
  getCurrentTime(): number;
  getWaveSurfer(): WaveSurfer | null;
}

export interface PlaylistCallbacks {
  onTrackChange?: (track: Track, index: number) => void;
  onPlay?: (track: Track, index: number) => void;
  onPause?: (track: Track, index: number) => void;
  onTrackEnd?: (track: Track, index: number) => void;
  onPlaylistEnd?: () => void;
  onError?: (error: Error, track: Track, index: number) => void;
  /**
   * Called with each wavesurfer.js instance after it's created and before it loads the
   * first track, e.g. to register plugins. React StrictMode creates two in development.
   */
  onInit?: (wavesurfer: WaveSurfer) => void;
}

export interface PlaylistProviderProps extends PlaylistCallbacks {
  tracks: readonly Track[];
  title?: ReactNode;
  artwork?: ImageSource;
  background?: BackgroundSource;
  /** @default 0 */
  initialTrack?: number;
  /** Play the next track when one finishes. @default true */
  autoAdvance?: boolean;
  /** Go back to the first track after the last one. @default false */
  loop?: boolean;
  /** Pause other Surfbort players on the page when this one starts. @default true */
  exclusive?: boolean;
  /** Show the current track in OS media controls and respond to media keys. @default true */
  mediaSession?: boolean;
  /** Fetch metadata for tracks without a `duration` so the list can show every length. @default false */
  preloadDurations?: boolean;
  /**
   * Sets the audio element's `preload`. `"none"` also holds back tracks that would download
   * in full (no `peaks` and `duration`, or `streaming` off) until they're played, so nothing
   * downloads before play. Unset leaves the browser's default.
   */
  preload?: Preload;
  /**
   * Tracks with `peaks` and `duration` play straight from their URL, which needs a server that
   * answers Range requests. `false` downloads each track in full when it loads and plays it from
   * memory, so seeking works on any host. @default true
   */
  streaming?: boolean;
  /** Seconds the arrow keys move the playhead. @default 5 */
  seekStep?: number;
  /** Used to re-read waveform colors when the theme changes. @default "system" */
  theme?: Theme;
  waveformOptions?: WaveformOptions;
  icons?: Partial<PlaylistIcons>;
  labels?: Partial<PlaylistLabels>;
  classNames?: PlaylistClassNames;
  styles?: PlaylistStyles;
  handleRef?: Ref<PlaylistHandle>;
  children?: ReactNode;
}

export interface PlaylistProps extends Omit<PlaylistProviderProps, "handleRef"> {
  /** Element for the playlist title. @default "h2" */
  titleAs?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "div";
  /** @default "left" */
  artworkPosition?: "left" | "right";
  /** Which optional controls the default layout shows. All default to true. */
  controls?: PlaylistControls;
  className?: string;
  style?: CSSProperties;
  /** Replaces the default layout, inside the themed root. */
  children?: ReactNode;
}

/** Props every exported part accepts, merged with the matching `classNames`/`styles` slot. */
export interface PartProps {
  className?: string;
  style?: CSSProperties;
}
