import type { BackgroundSource, ImageSource, Track } from "../types";

export function trackKey(track: Track): string {
  return track.id ?? track.src;
}

export function normalizeImage(image: ImageSource): { src: string; alt: string } {
  return typeof image === "string" ? { src: image, alt: "" } : { src: image.src, alt: image.alt ?? "" };
}

export function normalizeBackground(background: BackgroundSource): { src: string; stillSrc?: string } {
  return typeof background === "string" ? { src: background } : background;
}

export function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
}
