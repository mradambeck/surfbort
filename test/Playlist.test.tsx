import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Playlist, PlayPauseButton, TrackList, type PlaylistHandle } from "../src";
import { FakeWaveSurfer } from "./fakeWaveSurfer";
import { tracks } from "./fixtures";

function rows() {
  return within(screen.getByRole("list", { name: "Tracks" })).getAllByRole("listitem");
}

/** Renders a playlist and finishes loading its first track. */
function renderReady(props: Partial<Parameters<typeof Playlist>[0]> = {}) {
  const view = render(<Playlist title="Summer Demos" tracks={tracks} {...props} />);
  const ws = FakeWaveSurfer.latest();
  act(() => ws.finishLoad());
  return { ...view, ws, user: userEvent.setup() };
}

describe("rendering", () => {
  it("shows the title, numbered tracks, artwork and background", () => {
    render(
      <Playlist
        title="Summer Demos"
        tracks={tracks}
        artwork={{ src: "/cover.png", alt: "Cover art" }}
        background={{ src: "/waves.gif", stillSrc: "/waves.jpg" }}
      />,
    );

    expect(screen.getByRole("region", { name: "Summer Demos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Summer Demos" })).toBeInTheDocument();
    expect(rows()).toHaveLength(3);
    expect(rows()[0]).toHaveTextContent("01");
    expect(rows()[0]).toHaveTextContent("Low Tide");
    expect(rows()[0]).toHaveTextContent("3:02");
    expect(rows()[2]).toHaveTextContent("03");
    expect(screen.getByRole("img", { name: "Cover art" })).toHaveAttribute("src", "/cover.png");

    const still = document.querySelector("picture source");
    expect(still).toHaveAttribute("srcset", "/waves.jpg");
    expect(still).toHaveAttribute("media", "(prefers-reduced-motion: reduce)");
    expect(document.querySelector("picture img")).toHaveAttribute("src", "/waves.gif");
  });

  it("uses a track's own artwork while it's current", async () => {
    const withArt = [tracks[0]!, { ...tracks[1]!, artwork: "/set-break.png" }];
    const { user, ws } = renderReady({ tracks: withArt, artwork: "/cover.png" });
    const art = () => document.querySelector(".surfbort-artwork");
    expect(art()).toHaveAttribute("src", "/cover.png");

    await user.click(screen.getByRole("button", { name: "Play Set Break" }));
    act(() => ws.finishLoad());
    expect(art()).toHaveAttribute("src", "/set-break.png");
  });

  it("applies slot classNames and styles, and the theme", () => {
    render(
      <Playlist
        title="Summer Demos"
        tracks={tracks}
        theme="dark"
        className="mine"
        classNames={{ track: "row", playButton: "big" }}
        styles={{ title: { color: "red" } }}
      />,
    );

    const root = screen.getByRole("region", { name: "Summer Demos" });
    expect(root).toHaveClass("surfbort", "mine");
    expect(root).toHaveAttribute("data-theme", "dark");
    for (const row of rows()) expect(row).toHaveClass("surfbort-track", "row");
    expect(screen.getByRole("button", { name: "Play" })).toHaveClass("surfbort-play-button", "big");
    expect(screen.getByRole("heading", { name: "Summer Demos" })).toHaveStyle({ color: "rgb(255, 0, 0)" });
  });

  it("leaves data-theme off for the system theme", () => {
    render(<Playlist title="Summer Demos" tracks={tracks} />);
    expect(screen.getByRole("region", { name: "Summer Demos" })).not.toHaveAttribute("data-theme");
  });

  it("shows an empty state with no tracks", () => {
    render(<Playlist title="Summer Demos" tracks={[]} />);
    expect(screen.getByText("No tracks yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
  });

  it("hides optional controls", () => {
    render(<Playlist title="Summer Demos" tracks={tracks} controls={{ previous: false, volume: false }} />);
    expect(screen.queryByRole("button", { name: "Previous track" })).not.toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "Volume" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next track" })).toBeInTheDocument();
  });
});

describe("playback", () => {
  it("loads the first track on mount without playing it", () => {
    render(<Playlist title="Summer Demos" tracks={tracks} />);
    const ws = FakeWaveSurfer.latest();
    expect(ws.load).toHaveBeenCalledWith("/audio/low-tide.mp3", undefined, 182);
    expect(ws.play).not.toHaveBeenCalled();
  });

  it("plays a track from the list once it has loaded", async () => {
    const { user, ws } = renderReady();

    await user.click(screen.getByRole("button", { name: "Play Set Break" }));
    expect(ws.load).toHaveBeenLastCalledWith("/audio/set-break.mp3", tracks[1]!.peaks, 95);
    expect(ws.play).not.toHaveBeenCalled();
    // The request to play shows right away, so the button doesn't flicker while loading.
    expect(screen.getByRole("button", { name: "Pause" })).toHaveAttribute("data-loading");

    act(() => ws.finishLoad());
    expect(ws.play).toHaveBeenCalledTimes(1);
    const row = rows()[1]!;
    expect(row).toHaveAttribute("aria-current", "true");
    expect(row).toHaveAttribute("data-playing");
    expect(within(row).getByRole("button", { name: "Pause Set Break" })).toBeInTheDocument();
    expect(rows()[0]).not.toHaveAttribute("aria-current");
  });

  it("toggles the current track from its row", async () => {
    const { user, ws } = renderReady();
    await user.click(screen.getByRole("button", { name: "Play Low Tide" }));
    expect(ws.play).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Pause Low Tide" }));
    expect(ws.pause).toHaveBeenCalledTimes(1);
    expect(rows()[0]).toHaveAttribute("data-active");
    expect(rows()[0]).not.toHaveAttribute("data-playing");
  });

  it("toggles playback from the main button", async () => {
    const onPlay = vi.fn();
    const onPause = vi.fn();
    const { user, ws } = renderReady({ onPlay, onPause });

    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(ws.play).toHaveBeenCalled();
    expect(onPlay).toHaveBeenCalledWith(tracks[0], 0);

    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(ws.pause).toHaveBeenCalled();
    expect(onPause).toHaveBeenCalledWith(tracks[0], 0);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("ignores loads that a newer one superseded", async () => {
    const onError = vi.fn();
    const onPause = vi.fn();
    const { user, ws } = renderReady({ onError, onPause });

    await user.click(screen.getByRole("button", { name: "Play Low Tide" }));
    await user.click(screen.getByRole("button", { name: "Play Set Break" }));
    await user.click(screen.getByRole("button", { name: "Play Offshore" }));
    act(() => ws.finishLoad());

    expect(onError).not.toHaveBeenCalled();
    // Switching tracks pauses the old one, but that isn't the listener pausing.
    expect(onPause).not.toHaveBeenCalled();
    expect(screen.queryByText("This track couldn't be loaded.")).not.toBeInTheDocument();
    expect(within(rows()[2]!).getByRole("button", { name: "Pause Offshore" })).toBeInTheDocument();
  });

  it("reports a failed load and retries it on play", async () => {
    const onError = vi.fn();
    render(<Playlist title="Summer Demos" tracks={tracks} onError={onError} />);
    const ws = FakeWaveSurfer.latest();
    const user = userEvent.setup();

    act(() => ws.failLoad(new Error("404")));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "404" }), tracks[0], 0);
    expect(screen.getByText("This track couldn't be loaded.")).toBeInTheDocument();
    expect(rows()[0]).toHaveAttribute("data-error");

    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(ws.load).toHaveBeenCalledTimes(2);
    act(() => ws.finishLoad());
    expect(ws.play).toHaveBeenCalledTimes(1);
  });

  it("drops the play request when the browser refuses to play", async () => {
    const { user, ws } = renderReady();
    ws.refuseNextPlay = new DOMException("Autoplay blocked", "NotAllowedError");
    await user.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument());
  });
});

describe("track flow", () => {
  it("advances to the next track when one finishes", async () => {
    const onTrackEnd = vi.fn();
    const onTrackChange = vi.fn();
    const { user, ws } = renderReady({ onTrackEnd, onTrackChange });

    await user.click(screen.getByRole("button", { name: "Play" }));
    act(() => ws.end());
    expect(onTrackEnd).toHaveBeenCalledWith(tracks[0], 0);
    expect(onTrackChange).toHaveBeenCalledWith(tracks[1], 1);
    expect(ws.load).toHaveBeenLastCalledWith("/audio/set-break.mp3", tracks[1]!.peaks, 95);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();

    act(() => ws.finishLoad());
    expect(ws.play).toHaveBeenCalledTimes(2);
  });

  it("stops after the last track", async () => {
    const onPlaylistEnd = vi.fn();
    const { user, ws } = renderReady({ initialTrack: 2, onPlaylistEnd });
    await user.click(screen.getByRole("button", { name: "Play" }));
    act(() => ws.end());
    expect(onPlaylistEnd).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next track" })).toBeDisabled();
  });

  it("wraps to the first track with loop", async () => {
    const { user, ws } = renderReady({ initialTrack: 2, loop: true });
    expect(screen.getByRole("button", { name: "Next track" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Play" }));
    act(() => ws.end());
    expect(ws.load).toHaveBeenLastCalledWith("/audio/low-tide.mp3", undefined, 182);
  });

  it("doesn't advance with autoAdvance off", async () => {
    const { user, ws } = renderReady({ autoAdvance: false });
    await user.click(screen.getByRole("button", { name: "Play" }));
    act(() => ws.end());
    expect(ws.load).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("restarts with Previous after 3 seconds, and goes back a track before that", async () => {
    const { user, ws } = renderReady({ initialTrack: 1 });

    act(() => ws.advance(10));
    await user.click(screen.getByRole("button", { name: "Previous track" }));
    expect(ws.setTime).toHaveBeenLastCalledWith(0);
    expect(ws.load).toHaveBeenCalledTimes(1);

    act(() => ws.advance(1));
    await user.click(screen.getByRole("button", { name: "Previous track" }));
    expect(ws.load).toHaveBeenLastCalledWith("/audio/low-tide.mp3", undefined, 182);
  });

  it("skips forward without starting playback when paused", async () => {
    const { user, ws } = renderReady();
    await user.click(screen.getByRole("button", { name: "Next track" }));
    act(() => ws.finishLoad());
    expect(rows()[1]).toHaveAttribute("aria-current", "true");
    expect(ws.play).not.toHaveBeenCalled();
  });

  it("keeps the current track when the list is reordered", async () => {
    const { user, ws, rerender } = renderReady();
    await user.click(screen.getByRole("button", { name: "Play Set Break" }));
    act(() => ws.finishLoad());

    rerender(<Playlist title="Summer Demos" tracks={[tracks[1]!, tracks[0]!, tracks[2]!]} />);
    expect(rows()[0]).toHaveAttribute("aria-current", "true");
    expect(within(rows()[0]!).getByRole("button", { name: "Pause Set Break" })).toBeInTheDocument();
    expect(ws.load).toHaveBeenCalledTimes(2);
  });

  it("stops and selects a neighbor when the current track is removed", async () => {
    const { user, ws, rerender } = renderReady();
    await user.click(screen.getByRole("button", { name: "Play Set Break" }));
    act(() => ws.finishLoad());

    rerender(<Playlist title="Summer Demos" tracks={[tracks[0]!, tracks[2]!]} />);
    expect(ws.load).toHaveBeenLastCalledWith("/audio/offshore.mp3", undefined, undefined);
    expect(rows()[1]).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });
});

describe("seeking and volume", () => {
  it("exposes the waveform as a slider that seeks from the keyboard", async () => {
    const { user, ws } = renderReady();
    const slider = screen.getByRole("slider", { name: "Seek" });
    expect(slider).toHaveAttribute("aria-valuemax", "182");
    expect(slider).toHaveAttribute("aria-valuetext", "0:00 of 3:02");

    slider.focus();
    await user.keyboard("{ArrowRight}");
    expect(ws.setTime).toHaveBeenLastCalledWith(5);
    expect(slider).toHaveAttribute("aria-valuenow", "5");
    expect(slider).toHaveAttribute("aria-valuetext", "0:05 of 3:02");

    await user.keyboard("{PageUp}");
    expect(ws.setTime).toHaveBeenLastCalledWith(23.2);
    await user.keyboard("{End}");
    expect(ws.setTime).toHaveBeenLastCalledWith(182);
    await user.keyboard("{Home}");
    expect(ws.setTime).toHaveBeenLastCalledWith(0);
    await user.keyboard("{ArrowLeft}");
    expect(ws.setTime).toHaveBeenLastCalledWith(0);
  });

  it("holds new seeks until the media finishes the one in progress", async () => {
    const { user, ws } = renderReady();
    const slider = screen.getByRole("slider", { name: "Seek" });
    ws.holdSeeks = true;

    slider.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(ws.setTime).toHaveBeenCalledTimes(1);
    expect(ws.setTime).toHaveBeenLastCalledWith(5);
    // The slider shows where the listener asked to go, not where the media still is.
    expect(slider).toHaveAttribute("aria-valuenow", "15");
    act(() => ws.advance(2));
    expect(slider).toHaveAttribute("aria-valuenow", "15");

    act(() => ws.finishSeek());
    expect(ws.setTime).toHaveBeenCalledTimes(2);
    expect(ws.setTime).toHaveBeenLastCalledWith(15);

    act(() => ws.finishSeek());
    act(() => ws.advance(16));
    expect(slider).toHaveAttribute("aria-valuenow", "16");
  });

  it("lets a click on the waveform override a pending keyboard seek", async () => {
    const { user, ws } = renderReady();
    const slider = screen.getByRole("slider", { name: "Seek" });
    ws.holdSeeks = true;

    slider.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    act(() => ws.emit("interaction", 90));
    expect(slider).toHaveAttribute("aria-valuenow", "90");
    act(() => ws.finishSeek());
    // The keyboard target was dropped, so nothing else is sent.
    expect(ws.setTime).toHaveBeenCalledTimes(1);
  });

  it("stops at the end on End instead of moving on", async () => {
    const onTrackEnd = vi.fn();
    const onTrackChange = vi.fn();
    const onPause = vi.fn();
    const { user, ws } = renderReady({ onTrackEnd, onTrackChange, onPause });
    const slider = screen.getByRole("slider", { name: "Seek" });
    await user.click(screen.getByRole("button", { name: "Play" }));

    slider.focus();
    await user.keyboard("{End}");
    expect(ws.setTime).toHaveBeenLastCalledWith(182);
    expect(slider).toHaveAttribute("aria-valuenow", "182");
    expect(rows()[0]).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(ws.load).toHaveBeenCalledTimes(1);
    expect(onTrackEnd).not.toHaveBeenCalled();
    expect(onTrackChange).not.toHaveBeenCalled();
    expect(onPause).toHaveBeenCalledWith(tracks[0], 0);
  });

  it("stops at the end when the waveform is dragged there", async () => {
    const onTrackEnd = vi.fn();
    const { user, ws } = renderReady({ onTrackEnd });
    await user.click(screen.getByRole("button", { name: "Play" }));

    act(() => {
      ws.emit("interaction", 182);
      ws.end();
    });
    expect(rows()[0]).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(ws.load).toHaveBeenCalledTimes(1);
    expect(onTrackEnd).not.toHaveBeenCalled();
  });

  it("stays stopped at the end after End while the track loads", async () => {
    const onPlay = vi.fn();
    const onPause = vi.fn();
    const { user, ws } = renderReady({ onPlay, onPause });
    await user.click(screen.getByRole("button", { name: "Play Set Break" }));
    screen.getByRole("slider", { name: "Seek" }).focus();
    await user.keyboard("{End}");
    expect(ws.setTime).not.toHaveBeenCalled();

    act(() => ws.finishLoad());
    expect(ws.setTime).toHaveBeenLastCalledWith(95);
    expect(ws.play).not.toHaveBeenCalled();
    expect(rows()[1]).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(onPlay).not.toHaveBeenCalled();
    expect(onPause).not.toHaveBeenCalled();
  });

  it("plays the track over after stopping at the end", async () => {
    const { user, ws } = renderReady();
    screen.getByRole("slider", { name: "Seek" }).focus();
    await user.keyboard("{End}");

    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(ws.setTime).toHaveBeenLastCalledWith(0);
    expect(ws.play).toHaveBeenCalledTimes(1);
    expect(rows()[0]).toHaveAttribute("data-playing");
  });

  it("still moves on when playback reaches the end after a seek back from it", async () => {
    const onTrackEnd = vi.fn();
    const { user, ws } = renderReady({ onTrackEnd });
    screen.getByRole("slider", { name: "Seek" }).focus();
    await user.keyboard("{End}{ArrowLeft}");
    expect(ws.setTime).toHaveBeenLastCalledWith(177);

    await user.click(screen.getByRole("button", { name: "Play" }));
    act(() => ws.end());
    expect(onTrackEnd).toHaveBeenCalledWith(tracks[0], 0);
    expect(ws.load).toHaveBeenLastCalledWith("/audio/set-break.mp3", tracks[1]!.peaks, 95);
  });

  it("re-renders the time readout as playback moves", () => {
    const { ws } = renderReady();
    act(() => ws.advance(61.4));
    expect(screen.getByRole("slider", { name: "Seek" })).toHaveAttribute("aria-valuenow", "61");
    expect(document.querySelector(".surfbort-time-current")).toHaveTextContent("1:01");
  });

  it("sets volume and mutes", async () => {
    const { user, ws } = renderReady();
    const slider = screen.getByRole("slider", { name: "Volume" });

    fireEvent.change(slider, { target: { value: "0.4" } });
    expect(ws.setVolume).toHaveBeenLastCalledWith(0.4);

    await user.click(screen.getByRole("button", { name: "Mute" }));
    expect(ws.setMuted).toHaveBeenLastCalledWith(true);
    expect(slider).toHaveValue("0");

    // Raising the volume while muted unmutes.
    fireEvent.change(slider, { target: { value: "0.6" } });
    expect(ws.setMuted).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("button", { name: "Mute" })).toBeInTheDocument();
  });
});

describe("preload", () => {
  it("leaves the audio element's preload alone by default", () => {
    render(<Playlist title="Summer Demos" tracks={tracks} />);
    expect(FakeWaveSurfer.latest().media.preload).toBe("");
  });

  it("sets the audio element's preload", () => {
    render(<Playlist title="Summer Demos" tracks={tracks} preload="metadata" />);
    const ws = FakeWaveSurfer.latest();
    expect(ws.media.preload).toBe("metadata");
    expect(ws.load).toHaveBeenCalledWith("/audio/low-tide.mp3", undefined, 182);
  });

  it("calls onInit before loading the first track", () => {
    const loadsAtInit: number[] = [];
    render(
      <Playlist
        title="Summer Demos"
        tracks={tracks}
        onInit={(ws) => loadsAtInit.push((ws as unknown as FakeWaveSurfer).load.mock.calls.length)}
      />,
    );
    expect(loadsAtInit).toEqual([0]);
    expect(FakeWaveSurfer.latest().load).toHaveBeenCalledTimes(1);
  });

  it("with none, readies a track with peaks and a duration without holding it back", () => {
    renderReady({ preload: "none", initialTrack: 1 });
    const ws = FakeWaveSurfer.latest();
    expect(ws.load).toHaveBeenCalledWith("/audio/set-break.mp3", tracks[1]!.peaks, 95);
    expect(ws.media.preload).toBe("none");
    expect(screen.getByRole("slider", { name: "Seek" })).not.toHaveAttribute("data-loading");
  });

  it("with none, holds back a track without peaks until it's played", async () => {
    const { user, ws } = renderReady({ preload: "none" });
    // Only empty(), which clears the waveform without loading audio.
    expect(ws.load).toHaveBeenCalledTimes(1);
    expect(ws.load).toHaveBeenCalledWith("", [[0]], 0.001);
    const slider = screen.getByRole("slider", { name: "Seek" });
    expect(slider).not.toHaveAttribute("data-loading");
    expect(slider).toHaveAttribute("aria-valuetext", "0:00 of 3:02");
    expect(screen.getByRole("button", { name: "Play" })).not.toHaveAttribute("data-loading");

    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(ws.load).toHaveBeenLastCalledWith("/audio/low-tide.mp3", undefined, 182);
    expect(slider).toHaveAttribute("data-loading");
    expect(screen.getByRole("button", { name: "Pause" })).toHaveAttribute("data-loading");

    act(() => ws.finishLoad());
    expect(ws.play).toHaveBeenCalledTimes(1);
    expect(rows()[0]).toHaveAttribute("data-playing");
  });

  it("with none, selects tracks while paused without loading them", async () => {
    const { user, ws } = renderReady({ preload: "none", initialTrack: 1 });
    await user.click(screen.getByRole("button", { name: "Next track" }));
    expect(rows()[2]).toHaveAttribute("aria-current", "true");
    expect(ws.load).toHaveBeenLastCalledWith("", [[0]], 0.001);

    // Offshore has no duration, so it needs the metadata that "none" wouldn't fetch.
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(ws.load).toHaveBeenLastCalledWith("/audio/offshore.mp3", undefined, undefined);
    expect(ws.media.preload).toBe("metadata");
  });

  it("with none, plays from where the listener seeked before the track loaded", async () => {
    const { user, ws } = renderReady({ preload: "none" });
    const slider = screen.getByRole("slider", { name: "Seek" });
    slider.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(slider).toHaveAttribute("aria-valuenow", "10");
    expect(ws.setTime).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Play" }));
    act(() => ws.finishLoad());
    expect(ws.setTime).toHaveBeenLastCalledWith(10);
    expect(ws.play).toHaveBeenCalledTimes(1);
  });

  it("loads a held-back track once preload stops being none", () => {
    const { ws, rerender } = renderReady({ preload: "none" });
    rerender(<Playlist title="Summer Demos" tracks={tracks} preload="auto" />);
    expect(ws.load).toHaveBeenLastCalledWith("/audio/low-tide.mp3", undefined, 182);
    expect(ws.media.preload).toBe("auto");
  });
});

describe("streaming off", () => {
  function stubFetch(response: () => Promise<Response> = async () => audioResponse()) {
    const fetch = vi.fn((_url: string, _init?: RequestInit) => response());
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  function audioResponse(status = 200) {
    return new Response(status === 200 ? new Uint8Array(64) : null, {
      status,
      statusText: status === 200 ? "OK" : "Not Found",
      headers: { "Content-Type": "audio/mpeg", "Content-Length": "64" },
    });
  }

  it("draws the peaks, then downloads the track on play and plays it from memory", async () => {
    const fetch = stubFetch();
    const { user, ws } = renderReady({ streaming: false, preload: "none", initialTrack: 1 });
    expect(ws.load).toHaveBeenCalledTimes(1);
    expect(ws.load).toHaveBeenCalledWith("", tracks[1]!.peaks, 95);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Play" })).not.toHaveAttribute("data-loading");

    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(fetch).toHaveBeenCalledWith("/audio/set-break.mp3", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    await waitFor(() => expect(ws.loadBlob).toHaveBeenCalledWith(expect.any(Blob), tracks[1]!.peaks, 95));
    expect(ws.play).not.toHaveBeenCalled();

    act(() => ws.finishLoad());
    expect(ws.play).toHaveBeenCalledTimes(1);
  });

  it("downloads the current track on mount unless preload is none", async () => {
    const fetch = stubFetch();
    const ws = (render(<Playlist title="Summer Demos" tracks={tracks} streaming={false} />), FakeWaveSurfer.latest());
    expect(fetch).toHaveBeenCalledWith("/audio/low-tide.mp3", expect.anything());
    await waitFor(() => expect(ws.loadBlob).toHaveBeenCalledWith(expect.any(Blob), undefined, 182));
  });

  it("reports a failed download and retries it on play", async () => {
    const fetch = stubFetch(async () => audioResponse(404));
    const onError = vi.fn();
    render(<Playlist title="Summer Demos" tracks={tracks} streaming={false} onError={onError} />);
    await waitFor(() => expect(screen.getByText("This track couldn't be loaded.")).toBeInTheDocument());
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("404") }), tracks[0], 0);

    await userEvent.setup().click(screen.getByRole("button", { name: "Play" }));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("cancels a download when another track takes over", async () => {
    const fetch = stubFetch(() => new Promise<Response>(() => {}));
    const user = userEvent.setup();
    render(<Playlist title="Summer Demos" tracks={tracks} streaming={false} />);
    const firstSignal = fetch.mock.calls[0]![1]!.signal!;

    await user.click(screen.getByRole("button", { name: "Play Set Break" }));
    expect(firstSignal.aborted).toBe(true);
    expect(fetch).toHaveBeenLastCalledWith("/audio/set-break.mp3", expect.anything());
  });
});

describe("integration", () => {
  it("pauses other players when one starts", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Playlist title="First" tracks={tracks} />
        <Playlist title="Second" tracks={tracks} />
      </>,
    );
    const [first, second] = FakeWaveSurfer.instances;
    act(() => {
      first!.finishLoad();
      second!.finishLoad();
    });
    const firstPlayer = within(screen.getByRole("region", { name: "First" }));
    const secondPlayer = within(screen.getByRole("region", { name: "Second" }));

    await user.click(firstPlayer.getByRole("button", { name: "Play" }));
    await user.click(secondPlayer.getByRole("button", { name: "Play" }));
    expect(first!.pause).toHaveBeenCalled();
    expect(firstPlayer.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(secondPlayer.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("lets players opt out of pausing each other", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Playlist title="First" tracks={tracks} exclusive={false} />
        <Playlist title="Second" tracks={tracks} exclusive={false} />
      </>,
    );
    const [first, second] = FakeWaveSurfer.instances;
    act(() => {
      first!.finishLoad();
      second!.finishLoad();
    });
    await user.click(within(screen.getByRole("region", { name: "First" })).getByRole("button", { name: "Play" }));
    await user.click(within(screen.getByRole("region", { name: "Second" })).getByRole("button", { name: "Play" }));
    expect(first!.pause).not.toHaveBeenCalled();
  });

  it("keeps exactly one live instance under StrictMode", () => {
    const { unmount } = render(
      <StrictMode>
        <Playlist title="Summer Demos" tracks={tracks} />
      </StrictMode>,
    );
    expect(FakeWaveSurfer.live).toHaveLength(1);
    expect(FakeWaveSurfer.latest().load).toHaveBeenCalledWith("/audio/low-tide.mp3", undefined, 182);
    unmount();
    expect(FakeWaveSurfer.live).toHaveLength(0);
  });

  it("draws the waveform inside the Waveform part", () => {
    render(<Playlist title="Summer Demos" tracks={tracks} />);
    const container = FakeWaveSurfer.latest().options.container as HTMLElement;
    expect(container).toHaveClass("surfbort-waveform-canvas");
    expect(screen.getByRole("slider", { name: "Seek" })).toContainElement(container);
  });

  it("plays audio in a custom layout with no waveform", async () => {
    const user = userEvent.setup();
    render(
      <Playlist title="Summer Demos" tracks={tracks}>
        <PlayPauseButton />
        <TrackList />
      </Playlist>,
    );
    expect(screen.queryByRole("slider", { name: "Seek" })).not.toBeInTheDocument();
    const ws = FakeWaveSurfer.latest();
    expect((ws.options.container as HTMLElement).isConnected).toBe(false);

    act(() => ws.finishLoad());
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(ws.play).toHaveBeenCalled();
  });

  it("throws a clear error for parts outside a playlist", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<PlayPauseButton />)).toThrow(/inside <Playlist> or <PlaylistProvider>/);
  });

  it("passes waveformOptions through and applies changes live", () => {
    const onInit = vi.fn();
    const { rerender } = render(
      <Playlist title="Summer Demos" tracks={tracks} onInit={onInit} waveformOptions={{ barWidth: 4, waveColor: "red" }} />,
    );
    const ws = FakeWaveSurfer.latest();
    expect(onInit).toHaveBeenCalledWith(ws);
    expect(FakeWaveSurfer.create).toHaveBeenCalledWith(expect.objectContaining({ barWidth: 4, waveColor: "red", height: "auto" }));

    rerender(<Playlist title="Summer Demos" tracks={tracks} onInit={onInit} waveformOptions={{ barWidth: 6, waveColor: "red" }} />);
    expect(ws.setOptions).toHaveBeenLastCalledWith({ barWidth: 6 });
  });

  it("exposes an imperative handle", () => {
    const ref = createRef<PlaylistHandle>();
    render(<Playlist ref={ref} title="Summer Demos" tracks={tracks} />);
    const ws = FakeWaveSurfer.latest();
    act(() => ws.finishLoad());

    expect(ref.current!.getWaveSurfer()).toBe(ws);
    act(() => ref.current!.playTrack(2));
    expect(ws.load).toHaveBeenLastCalledWith("/audio/offshore.mp3", undefined, undefined);
    act(() => ws.finishLoad(240));
    expect(ws.play).toHaveBeenCalled();
    act(() => ref.current!.seek(30));
    expect(ref.current!.getCurrentTime()).toBe(30);
  });

  it("shows the current track in OS media controls", async () => {
    const setActionHandler = vi.fn();
    const mediaSession = { metadata: null as unknown, playbackState: "none", setActionHandler, setPositionState: vi.fn() };
    vi.stubGlobal("navigator", { ...navigator, mediaSession });
    vi.stubGlobal(
      "MediaMetadata",
      class {
        constructor(init: object) {
          Object.assign(this, init);
        }
      },
    );

    const { user, ws } = renderReady({ artwork: "/cover.png" });
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(mediaSession.metadata).toMatchObject({
      title: "Low Tide",
      artist: "Surfbort",
      album: "Summer Demos",
      artwork: [{ src: "/cover.png" }],
    });
    expect(mediaSession.playbackState).toBe("playing");

    const nextTrack = setActionHandler.mock.calls.find(([action]) => action === "nexttrack")?.[1];
    act(() => nextTrack());
    expect(ws.load).toHaveBeenLastCalledWith("/audio/set-break.mp3", tracks[1]!.peaks, 95);
  });

  it("preloads lengths for tracks without a duration", async () => {
    class FakeAudio extends EventTarget {
      preload = "";
      duration = Number.NaN;
      set src(_value: string) {
        queueMicrotask(() => {
          this.duration = 200;
          this.dispatchEvent(new Event("loadedmetadata"));
        });
      }
      removeAttribute() {}
      load() {}
    }
    vi.stubGlobal("Audio", FakeAudio);

    render(<Playlist title="Summer Demos" tracks={tracks} preloadDurations />);
    await waitFor(() => expect(rows()[2]).toHaveTextContent("3:20"));
  });
});
