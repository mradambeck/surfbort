import type { PlaylistLabels } from "./types";

export const defaultLabels: PlaylistLabels = {
  player: "Audio player",
  tracks: "Tracks",
  play: "Play",
  pause: "Pause",
  previous: "Previous track",
  next: "Next track",
  seek: "Seek",
  volume: "Volume",
  mute: "Mute",
  unmute: "Unmute",
  playTrack: (track) => `Play ${track.title}`,
  pauseTrack: (track) => `Pause ${track.title}`,
  timeOf: (current, total) => `${current} of ${total}`,
  loadError: "This track couldn't be loaded.",
  empty: "No tracks yet.",
};
