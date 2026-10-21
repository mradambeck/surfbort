import { usePlaylist, useSlots } from "../context";
import type { PlaylistControls, PlaylistProps } from "../types";
import { Artwork } from "./Artwork";
import { Background } from "./Background";
import { NowPlaying } from "./NowPlaying";
import { PlaylistTitle } from "./PlaylistTitle";
import { PlayPauseButton } from "./PlayPauseButton";
import { NextButton, PreviousButton } from "./SkipButtons";
import { TimeDisplay } from "./TimeDisplay";
import { TrackList } from "./TrackList";
import { VolumeControl } from "./VolumeControl";
import { Waveform } from "./Waveform";

export function DefaultLayout({ titleAs, controls }: { titleAs?: PlaylistProps["titleAs"]; controls?: PlaylistControls }) {
  const { background } = usePlaylist();
  const slot = useSlots();
  const show = { previous: true, next: true, time: true, volume: true, ...controls };

  return (
    <>
      <div {...slot("player", "surfbort-player")}>
        <Artwork />
        <div {...slot("panel", "surfbort-panel")} data-has-background={background ? true : undefined}>
          <Background />
          <div {...slot("header", "surfbort-header")}>
            <div {...slot("heading", "surfbort-heading")}>
              <PlaylistTitle as={titleAs} />
              <NowPlaying />
            </div>
            {show.volume && <VolumeControl />}
          </div>
          <div {...slot("transport", "surfbort-transport")}>
            {show.previous && <PreviousButton />}
            <PlayPauseButton />
            {show.next && <NextButton />}
            <div {...slot("seek", "surfbort-seek")}>
              <Waveform />
              {show.time && <TimeDisplay />}
            </div>
          </div>
        </div>
      </div>
      <TrackList />
    </>
  );
}
