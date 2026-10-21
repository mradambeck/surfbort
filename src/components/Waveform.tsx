import { useCallback, type CSSProperties, type KeyboardEvent } from "react";
import { useInternals, useLoadProgress, usePlaybackTime, usePlaylist, useSlots } from "../context";
import type { PartProps } from "../types";
import { formatTime } from "../utils/formatTime";

/**
 * The scrubbable waveform. wavesurfer.js draws into the inner element and handles click
 * and drag seeking; this wrapper adds slider semantics and keyboard seeking.
 */
export function Waveform(props: PartProps) {
  const { duration, status, seek, seekBy } = usePlaylist();
  const { engine, labels, seekStep } = useInternals();
  const time = usePlaybackTime();
  const loadProgress = useLoadProgress();
  const slot = useSlots()("waveform", "surfbort-waveform", props);
  const attach = useCallback((el: HTMLDivElement | null) => engine.attachContainer(el), [engine]);
  const max = Math.floor(duration);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const page = Math.max(duration / 10, seekStep);
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        seekBy(-seekStep);
        break;
      case "ArrowRight":
      case "ArrowUp":
        seekBy(seekStep);
        break;
      case "PageDown":
        seekBy(-page);
        break;
      case "PageUp":
        seekBy(page);
        break;
      case "Home":
        seek(0);
        break;
      case "End":
        seek(duration);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div
      {...slot}
      style={{ ...slot.style, "--surfbort-load-progress": `${loadProgress}%` } as CSSProperties}
      role="slider"
      tabIndex={0}
      aria-label={labels.seek}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(time, max)}
      aria-valuetext={labels.timeOf(formatTime(time), formatTime(duration))}
      data-loading={status === "loading" || undefined}
      onKeyDown={onKeyDown}
    >
      <div ref={attach} className="surfbort-waveform-canvas" />
    </div>
  );
}
