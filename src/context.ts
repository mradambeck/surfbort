import { createContext, useContext, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { PlaylistEngine } from "./controller/engine";
import type {
  BackgroundSource,
  ImageSource,
  LoadStatus,
  PartProps,
  PlaylistClassNames,
  PlaylistHandle,
  PlaylistIcons,
  PlaylistLabels,
  PlaylistStyles,
  SlotName,
  Track,
} from "./types";
import { cx } from "./utils/cx";

export interface PlaylistApi extends PlaylistHandle {
  tracks: readonly Track[];
  currentIndex: number;
  currentTrack: Track | undefined;
  /** True from the moment playback is requested until it pauses or stops, including while a track loads. */
  isPlaying: boolean;
  isLoading: boolean;
  status: LoadStatus;
  error: Error | null;
  /** Length of the current track in seconds, or 0 until it's known. */
  duration: number;
  volume: number;
  muted: boolean;
  /** Length of each track, when it's known. */
  durations: ReadonlyArray<number | undefined>;
  hasNext: boolean;
  hasPrevious: boolean;
  title: ReactNode;
  /** The current track's artwork, falling back to the playlist's. */
  artwork: ImageSource | undefined;
  /** The current track's background, falling back to the playlist's. */
  background: BackgroundSource | undefined;
  seekBy(seconds: number): void;
}

export interface PlaylistInternals {
  engine: PlaylistEngine;
  labels: PlaylistLabels;
  icons: PlaylistIcons;
  classNames: PlaylistClassNames;
  styles: PlaylistStyles;
  seekStep: number;
}

export const PlaylistContext = createContext<PlaylistApi | null>(null);
export const InternalsContext = createContext<PlaylistInternals | null>(null);

const MISSING_PROVIDER = "Surfbort parts and hooks must be rendered inside <Playlist> or <PlaylistProvider>.";

export function usePlaylist(): PlaylistApi {
  const api = useContext(PlaylistContext);
  if (!api) throw new Error(MISSING_PROVIDER);
  return api;
}

export function useInternals(): PlaylistInternals {
  const internals = useContext(InternalsContext);
  if (!internals) throw new Error(MISSING_PROVIDER);
  return internals;
}

/**
 * The current playback position. Whole seconds by default, so a component re-renders once a
 * second during playback; `precise` re-renders on every animation frame.
 */
export function usePlaybackTime(options: { precise?: boolean } = {}): number {
  const { time } = useInternals().engine;
  const read = options.precise ? time.get : () => Math.floor(time.get());
  return useSyncExternalStore(time.subscribe, read, read);
}

/** Download progress of the current track, 0–100. */
export function useLoadProgress(): number {
  const { loadProgress } = useInternals().engine;
  return useSyncExternalStore(loadProgress.subscribe, loadProgress.get, loadProgress.get);
}

export type SlotProps = { className?: string; style?: CSSProperties };

/** Builds className/style for a slot: the built-in class, then `classNames`/`styles`, then the part's own props. */
export function useSlots(): (name: SlotName, base: string, props?: PartProps) => SlotProps {
  const { classNames, styles } = useInternals();
  return (name, base, props = {}) => {
    const slotStyle = styles[name];
    return {
      className: cx(base, classNames[name], props.className),
      style: slotStyle || props.style ? { ...slotStyle, ...props.style } : undefined,
    };
  };
}
