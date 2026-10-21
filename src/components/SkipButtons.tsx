import { useInternals, usePlaylist, useSlots } from "../context";
import type { PartProps } from "../types";

/** Restarts the track when more than 3 seconds in, otherwise goes back one. */
export function PreviousButton(props: PartProps) {
  const { hasPrevious, previous } = usePlaylist();
  const { labels, icons } = useInternals();
  const slot = useSlots();
  return (
    <button
      type="button"
      {...slot("previousButton", "surfbort-skip-button surfbort-previous-button", props)}
      aria-label={labels.previous}
      disabled={!hasPrevious}
      onClick={() => previous()}
    >
      {icons.previous}
    </button>
  );
}

export function NextButton(props: PartProps) {
  const { hasNext, next } = usePlaylist();
  const { labels, icons } = useInternals();
  const slot = useSlots();
  return (
    <button
      type="button"
      {...slot("nextButton", "surfbort-skip-button surfbort-next-button", props)}
      aria-label={labels.next}
      disabled={!hasNext}
      onClick={() => next()}
    >
      {icons.next}
    </button>
  );
}
