import { usePlaybackTime, usePlaylist, useSlots } from "../context";
import type { PartProps } from "../types";
import { formatTime } from "../utils/formatTime";

/** Elapsed and total time for the current track. */
export function TimeDisplay(props: PartProps) {
  const { duration } = usePlaylist();
  const time = usePlaybackTime();
  const slot = useSlots();
  return (
    <div {...slot("time", "surfbort-time", props)}>
      <span className="surfbort-time-current">{formatTime(time)}</span>
      <span className="surfbort-visually-hidden"> / </span>
      <span className="surfbort-time-total">{formatTime(duration)}</span>
    </div>
  );
}
