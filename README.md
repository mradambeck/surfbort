# Surfbort

A React audio playlist player built on top of [wavesurfer.js](https://wavesurfer.xyz).

It shows a scrubbable waveform for the current track, a numbered track list with play/pause on every row, the playlist title, optional square album art beside the player, and an optional image or animated GIF behind it.

It looks finished with one stylesheet import, but every part of it can be restyled to fit your needs: CSS variables, stable class names, per-slot `classNames`/`styles`, or your own layout built from the exported parts.

## Install

```sh
npm install surfbort wavesurfer.js
```

`react` (18.2 or later) and `wavesurfer.js` (8.x) are peer dependencies.

## Quick start

```tsx
import { Playlist } from "surfbort";
import "surfbort/styles.css";

export function Album() {
  return (
    <Playlist
      title="Summer Demos"
      artwork="/art/cover.jpg"
      background={{ src: "/img/waves.gif", stillSrc: "/img/waves.jpg" }}
      tracks={[
        { src: "/audio/low-tide.mp3", title: "Low Tide", artist: "Surfbort", duration: 195 },
        { src: "/audio/set-break.mp3", title: "Set Break", artist: "Surfbort", artwork: "/art/set-break.jpg" },
      ]}
    />
  );
}
```

## Tracks

| Field | Type | |
| --- | --- | --- |
| `src` | `string` | Audio URL. |
| `title` | `string` | |
| `artist` | `string` | Optional. |
| `id` | `string` | Keeps a track current when `tracks` is replaced or reordered. Defaults to `src`. |
| `duration` | `number` | Seconds. Shown in the list before the track loads. |
| `peaks` | `number[][]` | Precomputed waveform peaks, one array per channel. See [Large files](#large-files) and [Generating peaks](#generating-peaks). |
| `artwork` | `string \| { src, alt }` | Replaces the playlist artwork while this track is current. |
| `background` | `string \| { src, stillSrc }` | Replaces the playlist background while this track is current. |

## Props

### Content

| Prop | Default | |
| --- | --- | --- |
| `tracks` | required | |
| `title` | | Playlist title, a string or any React node. A string also names the player's region and the album in OS media controls. |
| `titleAs` | `"h2"` | Element for the title: `h1`–`h6`, `p` or `div`. |
| `artwork` | | Square art beside the player. `alt` defaults to `""` because the titles sit next to it. |
| `background` | | Image or animated GIF behind the player. `stillSrc` is shown instead to visitors who prefer reduced motion. |

### Behavior

| Prop | Default | |
| --- | --- | --- |
| `initialTrack` | `0` | |
| `autoAdvance` | `true` | Play the next track when one ends. |
| `loop` | `false` | Go back to the first track after the last. |
| `exclusive` | `true` | Starting one Surfbort player pauses the others on the page. |
| `mediaSession` | `true` | Show the current track in OS media controls (lock screen, Control Center, media keys). |
| `preloadDurations` | `false` | Fetch metadata for tracks without a `duration`, three at a time, so the list shows every length. |
| `preload` | browser default | `"none"`, `"metadata"` or `"auto"`. `"none"` fetches nothing until play. See [Loading nothing until play](#loading-nothing-until-play). |
| `streaming` | `true` | `false` downloads each track in full and plays it from memory. A fallback for hosts that ignore `Range` requests; see [Streaming needs byte ranges](#streaming-needs-byte-ranges). |
| `seekStep` | `5` | Seconds the arrow keys move the playhead. |

### Appearance

| Prop | Default | |
| --- | --- | --- |
| `theme` | `"system"` | `"light"` or `"dark"` ignore the OS setting. |
| `artworkPosition` | `"left"` | `"right"` puts the art on the other side. |
| `controls` | all `true` | `{ previous, next, time, volume }` toggles optional controls in the default layout. |
| `className`, `style` | | Applied to the root. |
| `classNames`, `styles` | | Per-slot class names and inline styles. See [Slots](#slots). |
| `icons` | | Replace any of `play`, `pause`, `previous`, `next`, `volume`, `muted`, `loading`. |
| `labels` | | Every visible and spoken string, for translation. Track labels are functions, e.g. `playTrack: (track) => \`Play ${track.title}\``. |
| `waveformOptions` | | Passed to wavesurfer.js (bar width, gap, radius, colors, `normalize`, `plugins`, `fetchParams`, and so on). Changes apply live, except `plugins`, which are read when the instance is created. |

### Callbacks

`onTrackChange(track, index)`, `onPlay(track, index)`, `onPause(track, index)`, `onTrackEnd(track, index)`, `onPlaylistEnd()`, `onError(error, track, index)`, and `onInit(wavesurfer)`.

`onInit` receives each wavesurfer.js instance after it's created and before it loads the first track, so plugins and changes to the audio element (`wavesurfer.getMediaElement()`) apply from the first track on. React StrictMode creates two instances in development.

`onTrackEnd` fires when playback reaches the end of a track. A seek to the very end (the End key, or dragging past the right edge) stops there instead: it fires `onPause` if the track was playing, and the player stays on that track.

### Imperative handle

```tsx
const player = useRef<PlaylistHandle>(null);
<Playlist ref={player} tracks={tracks} />;

player.current?.playTrack(2);
```

`play()`, `pause()`, `toggle()`, `playTrack(index)`, `selectTrack(index)` (without starting playback), `next()`, `previous()`, `seek(seconds)`, `setVolume(0–1)`, `setMuted(boolean)`, `refreshWaveformColors()`, `getCurrentTime()`, `getWaveSurfer()`.

## Styling

### CSS variables

Set any of these on `.surfbort` or a class of your own. They're declared with zero specificity, so a single class overrides them in both themes.

```css
.my-player {
  --surfbort-accent: #e8590c;
  --surfbort-radius: 4px;
  --surfbort-font-family: Georgia, serif;
}
```

| Variable | |
| --- | --- |
| `--surfbort-font-family`, `--surfbort-font-size` | Typography. The base size is `0.9375rem`. |
| `--surfbort-bg`, `--surfbort-surface`, `--surfbort-border`, `--surfbort-shadow` | The card, the player panel, and the card's edge. |
| `--surfbort-fg`, `--surfbort-muted` | Text colors. |
| `--surfbort-accent`, `--surfbort-accent-fg` | Play buttons, progress, and the current track. |
| `--surfbort-highlight`, `--surfbort-track-active-bg` | The current track's text and row background. |
| `--surfbort-hover-bg`, `--surfbort-rail`, `--surfbort-focus-ring`, `--surfbort-danger` | Hover tint, the volume rail, focus outlines, errors. |
| `--surfbort-wave-color`, `--surfbort-progress-color`, `--surfbort-cursor-color` | Waveform colors. The canvas reads these from script, and they accept any CSS color. |
| `--surfbort-radius`, `--surfbort-radius-inner`, `--surfbort-padding`, `--surfbort-gap` | Shape and spacing. |
| `--surfbort-artwork-size`, `--surfbort-artwork-stacked-size` | Art width beside the panel, and once a narrow player stacks it. |
| `--surfbort-waveform-height`, `--surfbort-play-size`, `--surfbort-button-size` | Control sizes. |
| `--surfbort-on-image-*`, `--surfbort-scrim` | Colors used over a background image (`fg`, `muted`, `wave-color`, `progress-color`, `cursor-color`, `hover-bg`, `rail`, `danger`), and the gradient over the image. |

If your app changes these variables at runtime, for example with its own theme toggle, call `refreshWaveformColors()` on the handle so the canvas picks them up. OS theme changes are handled for you.

With the default `theme="system"`, every variable you don't override follows the visitor's OS setting. A site with only a dark design should pass `theme="dark"`: otherwise a visitor whose OS is in light mode gets the light values for those variables on a dark page.

### Class names and state

Every element has a `surfbort-*` class, and state is exposed as data attributes:

| Element | Attributes |
| --- | --- |
| `.surfbort` (root) | `data-theme`, `data-artwork-position` |
| `.surfbort-panel` | `data-has-background` |
| `.surfbort-track` | `data-active` (current track), `data-playing`, `data-loading`, `data-error` |
| `.surfbort-play-button` | `data-playing`, `data-loading` |
| `.surfbort-waveform` | `data-loading` |
| `.surfbort-volume` | `data-muted` |

The current track is highlighted whether it's playing or paused. To highlight only during playback:

```css
.surfbort-track[data-active]:not([data-playing]) {
  background: none;
  color: inherit;
}
```

Component rules use one class each, which beats element resets on the host page. To override one, load your CSS after `surfbort/styles.css` or add a class. Content-area rules with an extra class, like `.prose h2`, can still reach the title; Tailwind Typography users can add `not-prose` to the player.

The waveform lives in wavesurfer's shadow DOM. Its playhead and progress overlay can be styled with `::part()`:

```css
.surfbort-waveform ::part(cursor) {
  width: 3px;
  border-radius: 3px;
}
```

### Slots

`classNames` and `styles` take the same keys:

`root`, `player`, `artwork`, `panel`, `background`, `header`, `heading`, `title`, `nowPlaying`, `volume`, `muteButton`, `volumeSlider`, `transport`, `previousButton`, `playButton`, `nextButton`, `seek`, `waveform`, `time`, `trackList`, `track`, `trackNumber`, `trackButton`, `trackText`, `trackTitle`, `trackArtist`, `trackDuration`, `empty`.

```tsx
<Playlist tracks={tracks} classNames={{ track: "my-row", playButton: "my-play" }} styles={{ title: { letterSpacing: "0.1em" } }} />
```

### Tailwind CSS v4 and cascade layers

Import the stylesheet into a layer that comes before Tailwind's utilities, so utility classes passed through `classNames` win:

```css
@layer theme, base, surfbort, components, utilities;
@import "surfbort/styles.css" layer(surfbort);
@import "tailwindcss";
```

### Without the stylesheet

Skip the import and style the class names yourself. The waveform falls back to neutral colors until it finds the color variables.

## Custom layouts

Children of `<Playlist>` replace the default layout inside the themed root:

```tsx
import { NowPlaying, Playlist, PlayPauseButton, TimeDisplay, TrackList, Waveform } from "surfbort";

<Playlist title="Live at the Echo" tracks={tracks}>
  <NowPlaying />
  <Waveform />
  <PlayPauseButton />
  <TimeDisplay />
  <TrackList />
</Playlist>;
```

For parts spread across a page, use `PlaylistProvider`. It renders no markup, so wrap each group in `className="surfbort"` (and `data-theme`, if you force one) to get the theme:

```tsx
<PlaylistProvider title="Parts Bin" tracks={tracks}>
  <aside className="surfbort">
    <PlayPauseButton />
    <Waveform />
  </aside>
  <main className="surfbort">
    <TrackList />
  </main>
</PlaylistProvider>
```

Parts: `PlaylistTitle` (with an `as` prop), `NowPlaying`, `Artwork`, `Background`, `PlayPauseButton`, `PreviousButton`, `NextButton`, `Waveform`, `TimeDisplay`, `VolumeControl`, `TrackList`, `TrackItem`. Each accepts `className` and `style`.

Audio keeps working in layouts without a `<Waveform>`, and the waveform moves to wherever a `<Waveform>` mounts.

### Hooks

`usePlaylist()` returns the state (`tracks`, `currentIndex`, `currentTrack`, `isPlaying`, `isLoading`, `status`, `error`, `duration`, `volume`, `muted`, `durations`, `hasNext`, `hasPrevious`, and the resolved `artwork` and `background`) plus every handle method and `seekBy(seconds)`.

`usePlaybackTime()` returns the position in whole seconds and re-renders once a second during playback. `usePlaybackTime({ precise: true })` re-renders every frame.

`isPlaying` reflects the listener's intent: it turns true as soon as play is pressed, including while the next track loads, and false when they pause.

`status` is `"idle"` while `preload="none"` holds the current track back, then `"loading"` and `"ready"` once it's played.

## Accessibility

- The player is a region named by its title.
- The waveform is a slider with spoken values ("1:05 of 3:20"). Arrow keys move by `seekStep`, Page Up/Down by a tenth of the track, and Home/End jump to the ends. End stops playback at the end of the current track rather than moving on to the next one, and pressing play from there starts the track over.
- The track list is an ordered list, and the current track is marked `aria-current`. Each row has one button, stretched over the whole row, so it's a single tab stop and a click anywhere on the row works.
- Because the button covers the row, the focus ring is drawn on the row (`.surfbort-track`, through `:has(:focus-visible)`) and not on the focused button. A host-site test that checks the focused element's outline should check the row instead. Browsers without `:has()` outline the button.
- Every control is a native button or range input with a label from `labels`.
- Animated backgrounds swap to `stillSrc` for visitors who prefer reduced motion.
- The volume slider hides itself where the browser ignores volume changes (iOS Safari), and mute stays.

## Large files

Without `peaks`, wavesurfer.js downloads the whole file to draw its waveform, and playback can't start until that finishes. The player shows a download progress bar meanwhile. With `peaks` and `duration`, the track streams and starts right away.

Peaks are one array per channel of values between -1 and 1. Generate them once at build time with `surfbort peaks` (below) or [audiowaveform](https://github.com/bbc/audiowaveform), or in the browser with `getWaveSurfer().exportPeaks()` after a track loads.

Audio on another origin needs CORS headers whenever the player fetches the file instead of streaming it: tracks without peaks, and every track with `streaming={false}`. To send credentials or headers, pass `waveformOptions={{ fetchParams: { credentials: "include" } }}`.

### Generating peaks

`surfbort peaks` writes a `<name>.peaks.json` next to each WAV file:

```sh
npx surfbort peaks public/audio/low-tide.wav public/audio/set-break.wav
```

Each file holds the track's length in seconds and one channel of peaks, rounded to two decimals:

```json
{ "duration": 36.5, "peaks": [[0.12, 0.4, 0.38, 0.07]] }
```

One channel is enough. The bars show how loud each slice is and mirror it above and below the center, so each value is the loudest sample in its slice, from any channel. Spread the file into its track:

```tsx
import lowTidePeaks from "./audio/low-tide.peaks.json";

const tracks = [{ src: "/audio/low-tide.wav", title: "Low Tide", ...lowTidePeaks }];
```

The default is 800 points per track, and `--points` changes it. The default bars sit 4px apart at any pixel density (`barWidth` 2 plus `barGap` 2), so a 500px waveform draws 125 bars, and 800 points cover a waveform up to 3200px wide. A line waveform (`barWidth: 0`) looks smoothest with about one point per device pixel, so raise the count for that.

The same function is exported for scripts. It has no dependencies and also runs in the browser:

```js
import { readFile, writeFile } from "node:fs/promises";
import { peaksFromWav } from "surfbort/peaks";

const json = peaksFromWav(await readFile("audio/low-tide.wav"), { points: 800 });
await writeFile("audio/low-tide.peaks.json", JSON.stringify(json));
```

Both read WAV files only: 8, 16, 24 or 32-bit PCM, and 32 or 64-bit float, including WAVE_FORMAT_EXTENSIBLE. Other formats need a decoder, so convert them to WAV first (`ffmpeg -i track.mp3 track.wav`) or use audiowaveform.

### Loading nothing until play

By default the player loads the current track as soon as it mounts. A track without peaks downloads in full, and even with peaks, browsers like Chrome start fetching the file. `preload="none"` waits for play:

```tsx
<Playlist preload="none" tracks={tracks} />
```

- A track with `peaks` and `duration` draws its waveform and is ready without a request. The audio element fetches it once it's played.
- Any other track shows an empty waveform at full height, so nothing shifts, and downloads when it's played, with the progress bar.
- A seek made before a track loads takes effect once it has.

With `"none"`, give every track `peaks` and `duration`. A track without them starts playing only once its download finishes, after the tap that asked for it, and iOS Safari may block that until a second tap.

`"metadata"` and `"auto"` set the audio element's `preload` for tracks with peaks. Tracks without peaks download on mount either way, because drawing their waveform takes the whole file. `preloadDurations` makes requests of its own, so leave it off on a page that shouldn't fetch any audio before play.

### Streaming needs byte ranges

A track with `peaks` and `duration` plays straight from its URL. To seek into the part that hasn't downloaded yet, the browser sends a `Range` request, and the server has to answer `206 Partial Content`. When it doesn't, a seek past the downloaded part snaps back to 0:00 (in Chrome and Safari), and Safari may refuse to play the file at all. Tracks without peaks never show this, because wavesurfer.js plays them from the copy it downloaded, so adding peaks can look like it broke seeking.

Some hosts don't support ranges. Cloudflare Workers static assets and Cloudflare Pages, for example, answer a `Range` request with `200` and the whole file. To check a host, this should print `206` and a `Content-Range` header:

```sh
curl -s -D - -o /dev/null -r 0-99 https://example.com/audio/low-tide.wav
```

The fix belongs on the host. Serve the audio from something that answers ranges: object storage like R2 or S3, most CDNs and most web servers do. On Cloudflare Workers you can also add ranges in front of static assets: send the audio paths to your Worker with `assets.run_worker_first`, fetch the file from the `ASSETS` binding, and answer a `Range` request with `206` and the requested slice (or `416` when it starts past the end). That reads the whole file on every request, which is fine for files of a few megabytes. For bigger files, R2's `get()` reads just the range.

If you can't change the host, `streaming={false}` is the fallback. The player downloads each track in full when it loads (or when it's played, with `preload="none"`) and plays it from memory, so seeking works anywhere and peaks still draw right away. It has two costs. The first play waits for the whole file. And because playback starts after the download finishes rather than during the tap, iOS Safari may block it until a second tap; this hasn't been checked on a real iPhone yet. The download uses `waveformOptions.fetchParams`.

## Server rendering

The package ships as a client module (`"use client"`) and is safe to render on the server: wavesurfer.js is only created in an effect, after hydration. The markup for the title, artwork and track list is in the server HTML, and the waveform's height is reserved, so nothing shifts when it draws.

## Development

```sh
npm install
npx playwright install chromium webkit   # once, for the browser tests
npm run dev        # playground at http://localhost:5173, demo audio generated on first run
npm test           # unit tests (Vitest)
npm run test:e2e   # browser tests against the playground in Chromium and WebKit, with axe
npm run verify     # typecheck, lint, unit tests, build, e2e
```

The playground's demo audio, background GIF and peaks are synthesized by `scripts/make-demo-assets.mjs`, so there's nothing to license or download. Add `?demo=<id>` to the URL to show a single demo, for example `?demo=lazy`. The `no-range` demo is served the way hosts without byte-range support serve files.

## License

MIT
