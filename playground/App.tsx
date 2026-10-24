import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Artwork,
  NextButton,
  NowPlaying,
  Playlist,
  PlaylistProvider,
  PlaylistTitle,
  PlayPauseButton,
  PreviousButton,
  TimeDisplay,
  TrackList,
  Waveform,
  type PlaylistHandle,
  type Track,
} from "surfbort";

declare global {
  interface Window {
    /** Player handles, for the e2e tests. */
    __surfbort?: Record<string, RefObject<PlaylistHandle | null>>;
    /** Callbacks the players have fired, for the e2e tests. */
    __surfbortEvents?: string[];
  }
}

const demo = (name: string) => `/demo/${name}.wav`;

/** `?demo=<id>` renders only that demo, so a test can watch one player's requests. */
const onlyDemo = new URLSearchParams(window.location.search).get("demo");

function logEvent(event: string) {
  (window.__surfbortEvents ??= []).push(event);
}

const summerTracks: Track[] = [
  {
    src: demo("low-tide"),
    title: "Low Tide",
    artist: "Surfbort",
    duration: 36,
  },
  { src: demo("set-break"), title: "Set Break", artist: "Surfbort" },
  { src: demo("offshore"), title: "Offshore", artist: "Surfbort" },
  { src: demo("duck-dive"), title: "Duck Dive", artist: "Surfbort" },
];

const longTracks: Track[] = [
  ...summerTracks,
  ...summerTracks.map((track) => ({
    ...track,
    id: `${track.src}#reprise`,
    title: `${track.title} (Reprise)`,
  })),
];

const artTracks: Track[] = [
  {
    src: demo("set-break"),
    title: "Set Break",
    artist: "Sunset Collective",
    artwork: "/art/set-break.svg",
  },
  {
    src: demo("offshore"),
    title: "Offshore",
    artist: "Sunset Collective",
    artwork: "/art/offshore.svg",
  },
  {
    src: demo("duck-dive"),
    title: "Duck Dive",
    artist: "Sunset Collective",
    artwork: "/art/duck-dive.svg",
  },
];

type Peaks = Pick<Track, "duration" | "peaks">;

/** Set Break's precomputed peaks, so it streams instead of downloading first. */
function useSetBreakPeaks(): Peaks | null {
  const [peaks, setPeaks] = useState<Peaks | null>(null);
  useEffect(() => {
    fetch("/demo/set-break.peaks.json")
      .then((response) => response.json() as Promise<Peaks>)
      .then(setPeaks);
  }, []);
  return peaks;
}

function withPeaks(tracks: Track[], peaks: Peaks): Track[] {
  return tracks.map((track) =>
    track.title === "Set Break" ? { ...track, ...peaks } : track,
  );
}

/** Served by the dev server like a host without byte-range support. */
const fromNoRangeHost = (tracks: Track[]): Track[] =>
  tracks.map((track) => ({ ...track, src: `/no-range${track.src}` }));

function Demo({
  id,
  title,
  children,
  description,
}: {
  id: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  if (onlyDemo && onlyDemo !== id) return null;
  return (
    <section className="demo">
      <h2>{title}</h2>
      <p className="demo-description">{description}</p>
      {children}
    </section>
  );
}

export function App() {
  const setBreakPeaks = useSetBreakPeaks();
  const summer = useMemo(
    () => setBreakPeaks && withPeaks(summerTracks, setBreakPeaks),
    [setBreakPeaks],
  );
  const lazy = useMemo(() => summer?.slice(0, 3), [summer]);
  const noRange = useMemo(
    () =>
      setBreakPeaks && fromNoRangeHost(withPeaks(artTracks, setBreakPeaks)),
    [setBreakPeaks],
  );
  const summerRef = useRef<PlaylistHandle>(null);
  const lightRef = useRef<PlaylistHandle>(null);
  const darkRef = useRef<PlaylistHandle>(null);
  const sunsetRef = useRef<PlaylistHandle>(null);
  const pocketRef = useRef<PlaylistHandle>(null);
  const cappedRef = useRef<PlaylistHandle>(null);
  const partsRef = useRef<PlaylistHandle>(null);
  const lazyRef = useRef<PlaylistHandle>(null);
  const noRangeRef = useRef<PlaylistHandle>(null);
  useEffect(() => {
    window.__surfbort = {
      summer: summerRef,
      light: lightRef,
      dark: darkRef,
      sunset: sunsetRef,
      pocket: pocketRef,
      capped: cappedRef,
      parts: partsRef,
      lazy: lazyRef,
      noRange: noRangeRef,
    };
  }, []);

  return (
    <main>
      <header>
        <h1>Surfbort</h1>
        <p>
          A React playlist player built on wavesurfer.js. Every player below is
          the same component.
        </p>
      </header>

      <Demo
        id="default"
        title="Default"
        description="Follows the system theme. Animated GIF background with a still for reduced motion, playlist artwork, and Set Break streams from precomputed peaks. Lengths for tracks without a duration are preloaded."
      >
        {summer ? (
          <Playlist
            ref={summerRef}
            title="Summer Demos"
            titleAs="h3"
            artwork={{ src: "/art/cover.svg", alt: "Summer Demos cover" }}
            background={{
              src: "/demo/waves.gif",
              stillSrc: "/demo/waves-still.png",
            }}
            tracks={summer}
            preloadDurations
            onTrackEnd={(track) => logEvent(`trackEnd:${track.title}`)}
          />
        ) : (
          <p className="loading">Loading demo…</p>
        )}
      </Demo>

      <Demo
        id="themes"
        title="Forced themes"
        description='theme="light" and theme="dark" ignore the OS setting.'
      >
        <div className="stack">
          <Playlist
            ref={lightRef}
            title="Light Theme"
            titleAs="h3"
            theme="light"
            artwork="/art/cover.svg"
            tracks={summerTracks}
          />
          <Playlist
            ref={darkRef}
            title="Dark Theme"
            titleAs="h3"
            theme="dark"
            artwork="/art/cover.svg"
            tracks={summerTracks}
          />
        </div>
      </Demo>

      <Demo
        id="sunset"
        title="Rebranded with CSS variables"
        description="Only custom properties changed, plus artwork on the right and per-track art."
      >
        <Playlist
          ref={sunsetRef}
          className="sunset"
          title="Sunset Session"
          titleAs="h3"
          artworkPosition="right"
          tracks={artTracks}
        />
      </Demo>

      <Demo
        id="narrow"
        title="Narrow container"
        description="Breakpoints follow the player's width, not the viewport."
      >
        <div className="narrow">
          <Playlist
            ref={pocketRef}
            title="Pocket"
            titleAs="h3"
            artwork="/art/cover.svg"
            background="/demo/waves.gif"
            tracks={summerTracks}
          />
        </div>
      </Demo>

      <Demo
        id="capped"
        title="Capped height"
        description="maxHeight={460}. The header and transport stay put and the track list scrolls. The skip buttons scroll the current track into view."
      >
        <Playlist
          ref={cappedRef}
          title="Long Set"
          titleAs="h3"
          artwork="/art/cover.svg"
          preload="none"
          maxHeight={460}
          tracks={longTracks}
        />
      </Demo>

      <Demo
        id="parts"
        title="Built from parts"
        description="PlaylistProvider with the parts split across two cards. Wrapping each in .surfbort applies the theme."
      >
        <PlaylistProvider
          handleRef={partsRef}
          title="Parts Bin"
          artwork="/art/duck-dive.svg"
          tracks={artTracks}
        >
          <div className="parts">
            <div className="surfbort parts-card">
              <div className="parts-heading">
                <Artwork className="parts-artwork" />
                <div>
                  <PlaylistTitle as="h3" />
                  <NowPlaying />
                </div>
              </div>
              <Waveform />
              <div className="parts-transport">
                <PreviousButton />
                <PlayPauseButton />
                <NextButton />
                <TimeDisplay className="parts-time" />
              </div>
            </div>
            <div className="surfbort">
              <TrackList className="parts-list" />
            </div>
          </div>
        </PlaylistProvider>
      </Demo>

      <Demo
        id="lazy"
        title="Nothing loads until play"
        description='preload="none". Set Break has peaks, so its waveform draws right away. Low Tide and Offshore have none, so they download when played, and their waveform stays empty until then.'
      >
        {lazy ? (
          <Playlist
            ref={lazyRef}
            title="Night Swim"
            titleAs="h3"
            artwork="/art/cover.svg"
            preload="none"
            tracks={lazy}
          />
        ) : (
          <p className="loading">Loading demo…</p>
        )}
      </Demo>

      <Demo
        id="no-range"
        title="Hosts without byte ranges"
        description="These files come from a server that ignores Range requests, like Cloudflare Workers static assets. streaming={false} downloads each track when it's played, so seeking still works, and the peaks draw before that."
      >
        {noRange ? (
          <Playlist
            ref={noRangeRef}
            title="Static Host"
            titleAs="h3"
            artwork="/art/set-break.svg"
            preload="none"
            streaming={false}
            tracks={noRange}
          />
        ) : (
          <p className="loading">Loading demo…</p>
        )}
      </Demo>
    </main>
  );
}
