import { useInternals, usePlaylist, useSlots } from "../context";
import type { PartProps } from "../types";

/**
 * The current track's title and artist. Announced politely when the track changes.
 * A div rather than a <p>, so host-page rules like `.content p` don't restyle it.
 */
export function NowPlaying(props: PartProps) {
  const { currentTrack, status } = usePlaylist();
  const { labels } = useInternals();
  const slot = useSlots();
  if (!currentTrack) return null;
  const failed = status === "error";
  return (
    <div {...slot("nowPlaying", "surfbort-now-playing", props)} aria-live="polite" data-error={failed || undefined}>
      <span className="surfbort-now-playing-title">{currentTrack.title}</span>
      {currentTrack.artist && (
        <>
          <span className="surfbort-now-playing-separator" aria-hidden="true">
            {" · "}
          </span>
          <span className="surfbort-now-playing-artist">{currentTrack.artist}</span>
        </>
      )}
      {failed && <span className="surfbort-now-playing-error">{labels.loadError}</span>}
    </div>
  );
}
