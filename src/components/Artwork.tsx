import { usePlaylist, useSlots } from "../context";
import type { PartProps } from "../types";
import { normalizeImage } from "../utils/tracks";

/** The current track's artwork, or the playlist's. Renders nothing when there's neither. */
export function Artwork(props: PartProps) {
  const { artwork } = usePlaylist();
  const slot = useSlots();
  if (!artwork) return null;
  const { src, alt } = normalizeImage(artwork);
  return <img {...slot("artwork", "surfbort-artwork", props)} src={src} alt={alt} decoding="async" />;
}
