import {
  useEffect,
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
  }
}

const demo = (name: string) => `/demo/${name}.wav`;

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

const shortTracks: Track[] = [
  { src: demo("closeout"), title: "Closeout", artist: "Surfbort", duration: 5 },
  {
    src: demo("duck-dive"),
    title: "Duck Dive",
    artist: "Surfbort",
    duration: 26,
  },
];

/** Set Break's precomputed peaks, so it streams instead of downloading first. */
function useSummerTracks(): Track[] | null {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  useEffect(() => {
    fetch("/demo/set-break.peaks.json")
      .then(
        (response) =>
          response.json() as Promise<{ duration: number; peaks: number[][] }>,
      )
      .then(({ duration, peaks }) =>
        setTracks(
          summerTracks.map((track) =>
            track.title === "Set Break" ? { ...track, duration, peaks } : track,
          ),
        ),
      );
  }, []);
  return tracks;
}

function Demo({
  title,
  children,
  description,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="demo">
      <h2>{title}</h2>
      <p className="demo-description">{description}</p>
      {children}
    </section>
  );
}

export function App() {
  const summer = useSummerTracks();
  const summerRef = useRef<PlaylistHandle>(null);
  const lightRef = useRef<PlaylistHandle>(null);
  const darkRef = useRef<PlaylistHandle>(null);
  const sunsetRef = useRef<PlaylistHandle>(null);
  const pocketRef = useRef<PlaylistHandle>(null);
  const partsRef = useRef<PlaylistHandle>(null);
  const shortRef = useRef<PlaylistHandle>(null);
  useEffect(() => {
    window.__surfbort = {
      summer: summerRef,
      light: lightRef,
      dark: darkRef,
      sunset: sunsetRef,
      pocket: pocketRef,
      parts: partsRef,
      short: shortRef,
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
          />
        ) : (
          <p className="loading">Loading demo…</p>
        )}
      </Demo>

      <Demo
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
    </main>
  );
}
