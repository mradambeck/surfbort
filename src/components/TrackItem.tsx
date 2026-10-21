import { useInternals, usePlaylist, useSlots } from "../context";
import type { PartProps } from "../types";
import { formatTime } from "../utils/formatTime";

/**
 * One row of the track list. The row's only control is its play/pause button, which the
 * stylesheet stretches over the whole row so a click anywhere on it works.
 */
export function TrackItem({ index, ...props }: PartProps & { index: number }) {
  const { tracks, currentIndex, isPlaying, isLoading, status, durations, toggle, playTrack } = usePlaylist();
  const { labels, icons } = useInternals();
  const slot = useSlots();
  const track = tracks[index];
  if (!track) return null;

  const active = index === currentIndex;
  const playing = active && isPlaying;
  const duration = durations[index];

  return (
    <li
      {...slot("track", "surfbort-track", props)}
      aria-current={active ? "true" : undefined}
      data-active={active || undefined}
      data-playing={playing || undefined}
      data-loading={(playing && isLoading) || undefined}
      data-error={(active && status === "error") || undefined}
    >
      <span {...slot("trackNumber", "surfbort-track-number")} aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <button
        type="button"
        {...slot("trackButton", "surfbort-track-button")}
        aria-label={playing ? labels.pauseTrack(track) : labels.playTrack(track)}
        onClick={() => (active ? toggle() : playTrack(index))}
      >
        {playing ? (isLoading ? icons.loading : icons.pause) : icons.play}
      </button>
      <span {...slot("trackText", "surfbort-track-text")}>
        <span {...slot("trackTitle", "surfbort-track-title")}>{track.title}</span>
        {track.artist && <span {...slot("trackArtist", "surfbort-track-artist")}>{track.artist}</span>}
      </span>
      <span {...slot("trackDuration", "surfbort-track-duration")}>
        {duration != null ? formatTime(duration) : ""}
      </span>
    </li>
  );
}
