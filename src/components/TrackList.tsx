import { useEffect, useRef, type MouseEvent } from "react";
import { useInternals, usePlaylist, useSlots } from "../context";
import type { PartProps, Track } from "../types";
import { trackKey } from "../utils/tracks";
import { TrackItem } from "./TrackItem";

export function TrackList(props: PartProps) {
  const { tracks, currentIndex } = usePlaylist();
  const { labels } = useInternals();
  const slot = useSlots();
  const listRef = useRef<HTMLOListElement>(null);
  const shownIndex = useRef(currentIndex);
  const clickedIndex = useRef<number | null>(null);

  // A track made current from outside the list (skip buttons, auto-advance, media keys) may be
  // scrolled out of view when the list scrolls. One picked from the list is already in view.
  useEffect(() => {
    const clicked = clickedIndex.current;
    clickedIndex.current = null;
    if (currentIndex === shownIndex.current) return;
    shownIndex.current = currentIndex;
    if (currentIndex !== clicked && listRef.current) scrollIntoList(listRef.current, currentIndex);
  }, [currentIndex]);

  const rememberClick = (event: MouseEvent<HTMLOListElement>) => {
    const row = (event.target as Element).closest("li");
    clickedIndex.current = row ? Array.prototype.indexOf.call(event.currentTarget.children, row) : null;
  };

  if (!tracks.length) return <div {...slot("empty", "surfbort-empty")}>{labels.empty}</div>;
  const keys = uniqueKeys(tracks);
  return (
    <ol
      ref={listRef}
      {...slot("trackList", "surfbort-tracklist", props)}
      aria-label={labels.tracks}
      onClickCapture={rememberClick}
    >
      {keys.map((key, index) => (
        <TrackItem key={key} index={index} />
      ))}
    </ol>
  );
}

/**
 * Scrolls the list, and only the list, just far enough to show the row. Element.scrollIntoView
 * would also scroll the page to bring the list itself into view.
 */
function scrollIntoList(list: HTMLElement, index: number): void {
  const row = list.children[index];
  if (!row || list.scrollHeight <= list.clientHeight) return;
  const top = row.getBoundingClientRect().top - list.getBoundingClientRect().top - list.clientTop + list.scrollTop;
  const bottom = top + row.getBoundingClientRect().height;
  let target: number;
  if (top < list.scrollTop) target = top;
  else if (bottom > list.scrollTop + list.clientHeight) target = bottom - list.clientHeight;
  else return;
  const reduceMotion =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  list.scrollTo({ top: target, behavior: reduceMotion ? "auto" : "smooth" });
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
