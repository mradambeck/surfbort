import { useInternals, usePlaylist, useSlots } from "../context";
import type { PartProps, Track } from "../types";
import { trackKey } from "../utils/tracks";
import { TrackItem } from "./TrackItem";

export function TrackList(props: PartProps) {
  const { tracks } = usePlaylist();
  const { labels } = useInternals();
  const slot = useSlots();
  if (!tracks.length) return <div {...slot("empty", "surfbort-empty")}>{labels.empty}</div>;
  const keys = uniqueKeys(tracks);
  return (
    <ol {...slot("trackList", "surfbort-tracklist", props)} aria-label={labels.tracks}>
      {keys.map((key, index) => (
        <TrackItem key={key} index={index} />
      ))}
    </ol>
  );
}

/** Track keys with repeats numbered, so a song listed twice still gets a distinct React key. */
function uniqueKeys(tracks: readonly Track[]): string[] {
  const seen = new Map<string, number>();
  return tracks.map((track) => {
    const key = trackKey(track);
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    return count ? `${key}#${count}` : key;
  });
}
