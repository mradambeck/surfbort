// @vitest-environment node
/// <reference types="node" />
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "../src/cli";
import { peaksFromWav } from "../src/peaks";

interface WavSpec {
  /** Interleaved samples, -1 to 1. */
  samples: number[];
  channels?: number;
  sampleRate?: number;
  bits?: 8 | 16 | 24 | 32 | 64;
  float?: boolean;
  extensible?: boolean;
  /** An odd-sized chunk before `data`, which the reader has to skip, padding included. */
  junk?: boolean;
  tag?: number;
}

/** Writes a WAV file to bytes. */
function wav({ samples, channels = 1, sampleRate = 8000, bits = 16, float = false, extensible = false, junk = false, tag }: WavSpec): Uint8Array {
  const bytes = bits / 8;
  const fmtSize = extensible ? 40 : 16;
  const junkSize = junk ? 8 + 3 + 1 : 0;
  const dataSize = samples.length * bytes;
  const buffer = new ArrayBuffer(12 + 8 + fmtSize + junkSize + 8 + dataSize);
  const view = new DataView(buffer);
  const text = (at: number, value: string) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
  const formatTag = tag ?? (float ? 3 : 1);

  text(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, fmtSize, true);
  view.setUint16(20, extensible ? 0xfffe : formatTag, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytes, true);
  view.setUint16(32, channels * bytes, true);
  view.setUint16(34, bits, true);
  if (extensible) {
    view.setUint16(36, 22, true);
    view.setUint16(38, bits, true);
    view.setUint32(40, 0, true);
    // The sub-format GUID starts with the real format tag.
    view.setUint16(44, formatTag, true);
  }
  let at = 20 + fmtSize;
  if (junk) {
    text(at, "LIST");
    view.setUint32(at + 4, 3, true);
    at += junkSize;
  }
  text(at, "data");
  view.setUint32(at + 4, dataSize, true);
  at += 8;
  for (const sample of samples) {
    if (float && bits === 32) view.setFloat32(at, sample, true);
    else if (float) view.setFloat64(at, sample, true);
    else if (bits === 8) view.setUint8(at, Math.round(sample * 127) + 128);
    else if (bits === 16) view.setInt16(at, Math.round(sample * 0x7fff), true);
    else if (bits === 24) {
      const value = Math.round(sample * 0x7fffff);
      view.setUint8(at, value & 0xff);
      view.setUint8(at + 1, (value >> 8) & 0xff);
      view.setUint8(at + 2, (value >> 16) & 0xff);
    } else view.setInt32(at, Math.round(sample * 0x7fffffff), true);
    at += bytes;
  }
  return new Uint8Array(buffer);
}

describe("peaksFromWav", () => {
  it("keeps the loudest sample in each slice, as a magnitude", () => {
    const file = wav({ samples: [0.1, -0.5, 0.25, 0.2, -1, 0, 0, 0.05], sampleRate: 4 });
    expect(peaksFromWav(file, { points: 4 })).toEqual({ duration: 2, peaks: [[0.5, 0.25, 1, 0.05]] });
  });

  it("takes the loudest channel and reads 24-bit samples", () => {
    // Two stereo frames per slice: left, right, left, right.
    const file = wav({ samples: [0.1, 0.6, -0.2, 0, 0.3, 0.1, 0, -0.9], channels: 2, bits: 24 });
    expect(peaksFromWav(file, { points: 2 }).peaks).toEqual([[0.6, 0.9]]);
  });

  it.each([
    { bits: 8 as const, float: false },
    { bits: 32 as const, float: false },
    { bits: 32 as const, float: true },
    { bits: 64 as const, float: true },
  ])("reads $bits-bit $float float samples", ({ bits, float }) => {
    const file = wav({ samples: [0.5, -0.25], bits, float });
    expect(peaksFromWav(file, { points: 2 }).peaks).toEqual([[0.5, 0.25]]);
  });

  it("reads WAVE_FORMAT_EXTENSIBLE, skips other chunks, and clips float overs", () => {
    const file = wav({ samples: [1.5, 0.5], bits: 32, float: true, extensible: true, junk: true });
    expect(peaksFromWav(file, { points: 2 }).peaks).toEqual([[1, 0.5]]);
  });

  it("defaults to 800 points with two decimals", () => {
    const samples = Array.from({ length: 1600 }, (_, i) => (i % 2 ? 0.123456 : 0));
    const { duration, peaks } = peaksFromWav(wav({ samples, sampleRate: 44100 }));
    expect(peaks[0]).toHaveLength(800);
    expect(peaks[0].every((peak) => peak === 0.12)).toBe(true);
    expect(duration).toBe(0.036);
  });

  it("accepts a view into a larger buffer, like a pooled Node Buffer", () => {
    const file = wav({ samples: [0.5, -0.25] });
    const padded = new Uint8Array(file.length + 16);
    padded.set(file, 16);
    expect(peaksFromWav(padded.subarray(16), { points: 1 }).peaks).toEqual([[0.5]]);
  });

  it("says it reads WAV only when given another format", () => {
    const mp3 = new TextEncoder().encode("ID3\u0004\u0000\u0000 not really an mp3");
    expect(() => peaksFromWav(mp3)).toThrow(/Not a WAV file\. The peaks generator reads WAV only, because other formats need a decoder/);
  });

  it("rejects compressed WAV encodings", () => {
    expect(() => peaksFromWav(wav({ samples: [0, 0], tag: 2 }))).toThrow(/Compressed WAV \(format tag 2\)/);
  });
});

describe("surfbort peaks", () => {
  let dir: string;
  const output = { logs: [] as string[], errors: [] as string[] };
  const io = { log: (line: string) => output.logs.push(line), error: (line: string) => output.errors.push(line) };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "surfbort-peaks-"));
    output.logs = [];
    output.errors = [];
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("writes <name>.peaks.json next to each file", async () => {
    const file = join(dir, "low-tide.wav");
    await writeFile(file, wav({ samples: [0.5, -1, 0.25, 0], sampleRate: 2 }));

    expect(await main(["peaks", file, "--points", "2"], io)).toBe(0);
    const json = await readFile(join(dir, "low-tide.peaks.json"), "utf8");
    expect(JSON.parse(json)).toEqual({ duration: 2, peaks: [[1, 0.25]] });
    expect(output.logs).toEqual([`${join(dir, "low-tide.peaks.json")}: 2s, 2 points`]);
  });

  it("carries on past a file it can't read, then exits with 1", async () => {
    const good = join(dir, "good.wav");
    const bad = join(dir, "bad.mp3");
    await writeFile(good, wav({ samples: [0.5] }));
    await writeFile(bad, "ID3 not a wav");

    expect(await main(["peaks", bad, good, "--points=1"], io)).toBe(1);
    expect(output.errors).toEqual([expect.stringMatching(new RegExp(`^${bad}: Not a WAV file\\.`))]);
    expect(JSON.parse(await readFile(join(dir, "good.peaks.json"), "utf8"))).toEqual({ duration: 0, peaks: [[0.5]] });
  });

  it("explains its usage", async () => {
    expect(await main([], io)).toBe(1);
    expect(await main(["--help"], io)).toBe(0);
    expect(await main(["waveform"], io)).toBe(1);
    expect(await main(["peaks"], io)).toBe(1);
    expect(await main(["peaks", "a.wav", "--points", "lots"], io)).toBe(1);
    expect(output.logs[0]).toMatch(/^Usage: surfbort peaks <file\.wav\.\.\.>/);
    expect(output.errors).toEqual([
      expect.stringMatching(/^Usage/),
      expect.stringMatching(/^Unknown command "waveform"/),
      expect.stringMatching(/^Name at least one WAV file/),
      '--points needs a positive whole number, not "lots".',
    ]);
  });
});
