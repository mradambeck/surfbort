# Surfbort

A React audio playlist player built on [wavesurfer.js](https://wavesurfer.xyz). It shows a scrubbable waveform for the current track, a numbered track list with play/pause on every row, the playlist title, optional square album art beside the player, and an optional image or animated GIF behind it.

It looks finished with one stylesheet import, and every part of it can be restyled: CSS variables, stable class names, per-slot `classNames`/`styles`, or your own layout built from the exported parts.

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
| `peaks` | `number[][]` | Precomputed waveform peaks, one array per channel. See [Large files](#large-files). |
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

`onTrackChange(track, index)`, `onPlay(track, index)`, `onPause(track, index)`, `onTrackEnd(track, index)`, `onPlaylistEnd()`, `onError(error, track, index)`, and `onInit(wavesurfer)`, which receives each wavesurfer.js instance after it's created (React StrictMode creates two in development). Use it to register plugins.

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

## Accessibility

- The player is a region named by its title.
- The waveform is a slider with spoken values ("1:05 of 3:20"). Arrow keys move by `seekStep`, Page Up/Down by a tenth of the track, and Home/End jump to the ends.
- The track list is an ordered list, and the current track is marked `aria-current`. Each row has one button, stretched over the whole row, so it's a single tab stop and a click anywhere on the row works.
- Every control is a native button or range input with a label from `labels`.
- Animated backgrounds swap to `stillSrc` for visitors who prefer reduced motion.
- The volume slider hides itself where the browser ignores volume changes (iOS Safari), and mute stays.

## Large files

Without `peaks`, wavesurfer.js downloads the whole file to draw its waveform, and playback can't start until that finishes. The player shows a download progress bar meanwhile. With `peaks` and `duration`, the track streams and starts right away.

Peaks are one array per channel of values between -1 and 1. Generate them once on your server, for example with [audiowaveform](https://github.com/bbc/audiowaveform), or in the browser with `getWaveSurfer().exportPeaks()` after a track loads.

Audio on another origin needs CORS headers, because wavesurfer.js fetches it to draw the waveform. To send credentials or headers, pass `waveformOptions={{ fetchParams: { credentials: "include" } }}`.

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

The playground's demo audio, background GIF and peaks are synthesized by `scripts/make-demo-assets.mjs`, so there's nothing to license or download.

## License

MIT
