import { useInternals, usePlaylist, useSlots } from "../context";
import type { PartProps } from "../types";

export function PlayPauseButton(props: PartProps) {
  const { isPlaying, isLoading, currentTrack, toggle } = usePlaylist();
  const { labels, icons } = useInternals();
  const slot = useSlots();
  const waiting = isPlaying && isLoading;
  return (
    <button
      type="button"
      {...slot("playButton", "surfbort-play-button", props)}
      aria-label={isPlaying ? labels.pause : labels.play}
      data-playing={isPlaying || undefined}
      data-loading={waiting || undefined}
      disabled={!currentTrack}
      onClick={toggle}
    >
      {waiting ? icons.loading : isPlaying ? icons.pause : icons.play}
    </button>
  );
}
