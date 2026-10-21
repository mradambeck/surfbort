import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { defaultIcons } from "./components/icons";
import { InternalsContext, PlaylistContext, type PlaylistApi, type PlaylistInternals } from "./context";
import { PlaylistEngine } from "./controller/engine";
import { defaultLabels } from "./labels";
import type { PlaylistHandle, PlaylistProviderProps } from "./types";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Playback state and controls for the parts inside it. Renders no markup of its own, so
 * the parts can be spread across a page; wrap them in `className="surfbort"` for the theme.
 */
export function PlaylistProvider({
  tracks,
  title,
  artwork,
  background,
  initialTrack = 0,
  autoAdvance = true,
  loop = false,
  exclusive = true,
  mediaSession = true,
  preloadDurations = false,
  preload,
  streaming = true,
  seekStep = 5,
  theme = "system",
  waveformOptions,
  icons,
  labels,
  classNames,
  styles,
  handleRef,
  children,
  onTrackChange,
  onPlay,
  onPause,
  onTrackEnd,
  onPlaylistEnd,
  onError,
  onInit,
}: PlaylistProviderProps) {
  const [engine] = useState(
    () =>
      new PlaylistEngine(tracks, initialTrack, {
        autoAdvance,
        loop,
        exclusive,
        mediaSession,
        preload,
        streaming,
        waveformOptions,
      }),
  );

  useIsomorphicLayoutEffect(() => {
    engine.setCallbacks({ onTrackChange, onPlay, onPause, onTrackEnd, onPlaylistEnd, onError, onInit });
  });

  useIsomorphicLayoutEffect(() => {
    engine.setConfig({ autoAdvance, loop, exclusive, mediaSession, preload, streaming, waveformOptions });
  }, [engine, autoAdvance, loop, exclusive, mediaSession, preload, streaming, waveformOptions]);

  useIsomorphicLayoutEffect(() => {
    engine.setTracks(tracks);
  }, [engine, tracks]);

  const album = typeof title === "string" ? title : undefined;
  useIsomorphicLayoutEffect(() => {
    engine.setMediaInfo({ album, artwork });
  }, [engine, album, artwork]);

  useEffect(() => {
    engine.mount();
    return () => engine.unmount();
  }, [engine]);

  useEffect(() => {
    engine.refreshColors();
  }, [engine, theme]);

  useEffect(() => {
    if (preloadDurations) return engine.preloadDurations();
  }, [engine, preloadDurations, tracks]);

  const handle = useMemo<PlaylistHandle>(
    () => ({
      play: engine.play,
      pause: engine.pause,
      toggle: engine.toggle,
      playTrack: engine.playTrack,
      selectTrack: engine.selectTrack,
      next: engine.next,
      previous: engine.previous,
      seek: engine.seek,
      setVolume: engine.setVolume,
      setMuted: engine.setMuted,
      refreshWaveformColors: engine.refreshColors,
      getCurrentTime: engine.getCurrentTime,
      getWaveSurfer: engine.getWaveSurfer,
    }),
    [engine],
  );
  useImperativeHandle(handleRef, () => handle, [handle]);

  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);

  const api = useMemo<PlaylistApi>(() => {
    const currentTrack = state.tracks[state.index];
    return {
      ...handle,
      seekBy: engine.seekBy,
      tracks: state.tracks,
      currentIndex: state.index,
      currentTrack,
      isPlaying: state.isPlaying,
      isLoading: state.status === "loading",
      status: state.status,
      error: state.error,
      duration: state.duration,
      volume: state.volume,
      muted: state.muted,
      durations: state.durations,
      hasNext: state.index < state.tracks.length - 1 || (loop && state.tracks.length > 1),
      hasPrevious: state.tracks.length > 0,
      title,
      artwork: currentTrack?.artwork ?? artwork,
      background: currentTrack?.background ?? background,
    };
  }, [engine, handle, state, loop, title, artwork, background]);

  const internals = useMemo<PlaylistInternals>(
    () => ({
      engine,
      labels: { ...defaultLabels, ...labels },
      icons: { ...defaultIcons, ...icons },
      classNames: classNames ?? {},
      styles: styles ?? {},
      seekStep,
    }),
    [engine, labels, icons, classNames, styles, seekStep],
  );

  return (
    <InternalsContext.Provider value={internals}>
      <PlaylistContext.Provider value={api}>{children}</PlaylistContext.Provider>
    </InternalsContext.Provider>
  );
}
