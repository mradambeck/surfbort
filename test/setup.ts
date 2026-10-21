import { afterEach, vi } from "vitest";
import { FakeWaveSurfer } from "./fakeWaveSurfer";

vi.mock("wavesurfer.js", async () => {
  const fake = await import("./fakeWaveSurfer");
  return { default: fake.FakeWaveSurfer };
});

// The SSR test runs in a node environment, which has no DOM for these.
if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());
}

afterEach(() => {
  FakeWaveSurfer.reset();
  vi.unstubAllGlobals();
});
