import { useState } from "react";
import { usePlaylist, useSlots, type SlotProps } from "../context";
import type { PartProps } from "../types";
import { usePrefersReducedMotion } from "../utils/reducedMotion";
import { normalizeBackground } from "../utils/tracks";

/**
 * The background image or GIF, swapped for its still under prefers-reduced-motion.
 * It's decorative, so the image has empty alt text.
 */
export function Background(props: PartProps) {
  const { background, isPlaying } = usePlaylist();
  const slot = useSlots();
  if (!background) return null;
  const { src, stillSrc, animate } = normalizeBackground(background);
  const slotProps = slot("background", "surfbort-background", props);
  if (animate === "playing" && stillSrc) {
    // Keyed so a new track's background starts over with nothing fetched.
    return (
      <AnimatedWhilePlaying key={`${src} ${stillSrc}`} src={src} stillSrc={stillSrc} isPlaying={isPlaying} {...slotProps} />
    );
  }
  return (
    <picture {...slotProps}>
      {stillSrc && <source srcSet={stillSrc} media="(prefers-reduced-motion: reduce)" />}
      <img src={src} alt="" decoding="async" />
    </picture>
  );
}

/**
 * The still, with the animation layered over it during playback. The animation is fetched on
 * the first play and shown once it has loaded, so the still stays up in the meantime.
 */
function AnimatedWhilePlaying({
  src,
  stillSrc,
  isPlaying,
  ...slotProps
}: SlotProps & { src: string; stillSrc: string; isPlaying: boolean }) {
  const reduceMotion = usePrefersReducedMotion();
  const wanted = isPlaying && !reduceMotion;
  const [requested, setRequested] = useState(wanted);
  const [loaded, setLoaded] = useState(false);
  if (wanted && !requested) setRequested(true);
  const animating = wanted && loaded;

  return (
    <span {...slotProps} data-animating={animating || undefined}>
      <img src={stillSrc} alt="" decoding="async" />
      {requested && (
        <img
          className="surfbort-background-animation"
          src={src}
          alt=""
          decoding="async"
          hidden={!animating}
          onLoad={() => setLoaded(true)}
        />
      )}
    </span>
  );
}
