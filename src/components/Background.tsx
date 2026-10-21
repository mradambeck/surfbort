import { usePlaylist, useSlots } from "../context";
import type { PartProps } from "../types";
import { normalizeBackground } from "../utils/tracks";

/**
 * The background image or GIF, swapped for its still under prefers-reduced-motion.
 * It's decorative, so the image has empty alt text.
 */
export function Background(props: PartProps) {
  const { background } = usePlaylist();
  const slot = useSlots();
  if (!background) return null;
  const { src, stillSrc } = normalizeBackground(background);
  return (
    <picture {...slot("background", "surfbort-background", props)}>
      {stillSrc && <source srcSet={stillSrc} media="(prefers-reduced-motion: reduce)" />}
      <img src={src} alt="" decoding="async" />
    </picture>
  );
}
