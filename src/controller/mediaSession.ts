/**
 * navigator.mediaSession is page-global, so the player that started most recently owns it.
 * Every update from a player that isn't the owner is ignored.
 */

export interface MediaSessionClient {
  play(): void;
  pause(): void;
  next(): void;
  previous(): void;
  seek(seconds: number): void;
  seekBy(seconds: number): void;
}

export interface MediaSessionTrack {
  title: string;
  artist?: string;
  album?: string;
  artwork?: string;
}

const ACTIONS: MediaSessionAction[] = [
  "play",
  "pause",
  "stop",
  "previoustrack",
  "nexttrack",
  "seekto",
  "seekbackward",
  "seekforward",
];

const DEFAULT_SKIP_SECONDS = 10;

let owner: MediaSessionClient | null = null;

function session(): MediaSession | null {
  return typeof navigator !== "undefined" && "mediaSession" in navigator ? navigator.mediaSession : null;
}

function handlerFor(client: MediaSessionClient, action: MediaSessionAction): MediaSessionActionHandler {
  switch (action) {
    case "play":
      return () => client.play();
    case "pause":
    case "stop":
      return () => client.pause();
    case "previoustrack":
      return () => client.previous();
    case "nexttrack":
      return () => client.next();
    case "seekto":
      return (details) => {
        if (details.seekTime != null) client.seek(details.seekTime);
      };
    case "seekbackward":
      return (details) => client.seekBy(-(details.seekOffset ?? DEFAULT_SKIP_SECONDS));
    case "seekforward":
      return (details) => client.seekBy(details.seekOffset ?? DEFAULT_SKIP_SECONDS);
    default:
      return () => {};
  }
}

function setHandlers(client: MediaSessionClient | null): void {
  const mediaSession = session();
  if (!mediaSession) return;
  for (const action of ACTIONS) {
    try {
      mediaSession.setActionHandler(action, client ? handlerFor(client, action) : null);
    } catch {
      // Browsers throw for actions they don't support.
    }
  }
}

export function isOwner(client: MediaSessionClient): boolean {
  return owner === client;
}

export function claim(client: MediaSessionClient): void {
  if (owner === client || !session()) return;
  owner = client;
  setHandlers(client);
}

export function release(client: MediaSessionClient): void {
  if (owner !== client) return;
  owner = null;
  setHandlers(null);
  const mediaSession = session();
  if (mediaSession) {
    mediaSession.metadata = null;
    mediaSession.playbackState = "none";
  }
}

export function setMetadata(client: MediaSessionClient, track: MediaSessionTrack): void {
  const mediaSession = session();
  if (owner !== client || !mediaSession || typeof MediaMetadata === "undefined") return;
  mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist ?? "",
    album: track.album ?? "",
    artwork: track.artwork ? [{ src: track.artwork }] : [],
  });
}

export function setPlaybackState(client: MediaSessionClient, state: MediaSessionPlaybackState): void {
  const mediaSession = session();
  if (owner === client && mediaSession) mediaSession.playbackState = state;
}

export function setPosition(client: MediaSessionClient, duration: number, position: number): void {
  const mediaSession = session();
  if (owner !== client || !mediaSession?.setPositionState || !(duration > 0)) return;
  try {
    mediaSession.setPositionState({ duration, position: Math.min(Math.max(position, 0), duration), playbackRate: 1 });
  } catch {
    // setPositionState throws on values the browser considers out of range.
  }
}
