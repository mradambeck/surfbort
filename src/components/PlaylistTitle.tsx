import { usePlaylist, useSlots } from "../context";
import type { PartProps, PlaylistProps } from "../types";

export function PlaylistTitle({ as: Tag = "h2", ...props }: PartProps & { as?: PlaylistProps["titleAs"] }) {
  const { title } = usePlaylist();
  const slot = useSlots();
  if (title == null || title === false || title === "") return null;
  return <Tag {...slot("title", "surfbort-title", props)}>{title}</Tag>;
}
