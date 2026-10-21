// @vitest-environment node
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { Playlist } from "../src";
import { tracks } from "./fixtures";

// Use the real wavesurfer.js here: importing it on a server must not touch the DOM.
vi.unmock("wavesurfer.js");

it("renders on the server without a DOM", () => {
  const html = renderToString(
    <Playlist title="Summer Demos" tracks={tracks} artwork="/cover.png" background="/waves.gif" />,
  );
  expect(html).toContain("Summer Demos");
  expect(html).toContain("Low Tide");
  expect(html).toContain("Offshore");
  expect(html).toContain('role="slider"');
  expect(html).toContain('src="/cover.png"');
});
