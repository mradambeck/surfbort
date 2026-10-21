import { useSyncExternalStore, type CSSProperties } from "react";
import { useInternals, usePlaylist, useSlots } from "../context";
import type { PartProps } from "../types";

let volumeSupported: boolean | undefined;

/** iOS ignores scripted volume changes and keeps reporting 1, so a slider there does nothing. */
function canSetVolume(): boolean {
  if (volumeSupported === undefined) {
    const audio = document.createElement("audio");
    audio.volume = 0.5;
    volumeSupported = audio.volume === 0.5;
  }
  return volumeSupported;
}

const neverChanges = () => () => {};
const assumeSupported = () => true;

/** Mute toggle plus a volume slider. The slider hides itself where the browser ignores volume. */
export function VolumeControl(props: PartProps) {
  const { volume, muted, setVolume, setMuted } = usePlaylist();
  const { labels, icons } = useInternals();
  const slot = useSlots();
  const adjustable = useSyncExternalStore(neverChanges, canSetVolume, assumeSupported);
  const level = muted ? 0 : volume;
  const slider = slot("volumeSlider", "surfbort-volume-slider");

  return (
    <div {...slot("volume", "surfbort-volume", props)} data-muted={muted || undefined}>
      <button
        type="button"
        {...slot("muteButton", "surfbort-mute-button")}
        aria-label={muted ? labels.unmute : labels.mute}
        onClick={() => setMuted(!muted)}
      >
        {muted || volume === 0 ? icons.muted : icons.volume}
      </button>
      {adjustable && (
        <input
          type="range"
          {...slider}
          style={{ ...slider.style, "--surfbort-volume-level": `${level * 100}%` } as CSSProperties}
          min={0}
          max={1}
          step={0.01}
          value={level}
          aria-label={labels.volume}
          onChange={(event) => setVolume(Number(event.currentTarget.value))}
        />
      )}
    </div>
  );
}
