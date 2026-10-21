// Generates the playground's demo media into playground/public/demo: synthesized tracks
// (WAV), a peaks file for one of them, and an animated GIF background with a still frame.
// Everything is computed here, so there's nothing to license and no ffmpeg to install.
//
//   node scripts/make-demo-assets.mjs              regenerate everything
//   node scripts/make-demo-assets.mjs --if-missing skip when the current version exists

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import gifenc from "gifenc";

const { GIFEncoder, quantize, applyPalette } = gifenc;

/** Bump when the output changes, so --if-missing regenerates. */
const VERSION = 1;
const OUT = join(import.meta.dirname, "../playground/public/demo");
const MANIFEST = join(OUT, "manifest.json");
const SAMPLE_RATE = 22050;
const TAU = Math.PI * 2;

if (process.argv.includes("--if-missing") && existsSync(MANIFEST)) {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  if (manifest.version === VERSION) process.exit(0);
}
mkdirSync(OUT, { recursive: true });

// --- Audio ---------------------------------------------------------------------------

/** Seeded PRNG (mulberry32), so every run writes identical files. */
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Frequency of a note, in semitones from A3. */
const note = (semitones) => 220 * 2 ** (semitones / 12);

/** Short fade at the start and a longer one at the end, so nothing clicks. */
const fade = (t, length) => Math.min(1, t / 0.02, (length - t) / 0.6);

function render(seconds, sample) {
  const samples = new Float32Array(Math.round(seconds * SAMPLE_RATE));
  for (let i = 0; i < samples.length; i++) samples[i] = sample(i / SAMPLE_RATE);
  let max = 0;
  for (const value of samples) max = Math.max(max, Math.abs(value));
  for (let i = 0; i < samples.length; i++) samples[i] = (samples[i] / max) * 0.9;
  return samples;
}

const tracks = {
  // Slow swells: a pad chord and a noise wash under a nine-second tide.
  "low-tide": (() => {
    const noise = random(1);
    return render(36, (t) => {
      const swell = 0.55 + 0.45 * Math.sin((TAU * t) / 9 - Math.PI / 2);
      const chord =
        Math.sin(TAU * note(-12) * t) +
        0.6 * Math.sin(TAU * note(-5) * t) +
        0.4 * Math.sin(TAU * note(0) * t) +
        0.25 * Math.sin(TAU * note(4) * t);
      const wash = (noise() * 2 - 1) * 0.3 * (0.5 + 0.5 * Math.sin((TAU * t) / 4.5));
      return (chord * 0.5 + wash) * swell * fade(t, 36);
    });
  })(),

  // A beat at 120 bpm: kick, off-beat hats, a moving bass line, quieter intro and outro.
  "set-break": (() => {
    const noise = random(2);
    return render(30, (t) => {
      const beat = t % 0.5;
      const kick = Math.sin(TAU * 52 * beat * (1 + 2.5 * Math.exp(-beat * 28))) * Math.exp(-beat * 9);
      const hat = (noise() * 2 - 1) * Math.exp(-((t + 0.25) % 0.5) * 55) * 0.35;
      const bassNote = [0, 0, 3, -2][Math.floor(t / 2) % 4];
      const bass = Math.sin(TAU * note(bassNote - 24) * t) * Math.exp(-(t % 0.25) * 6) * 0.55;
      const section = t < 4 ? 0.45 : t > 25 ? 0.6 : 1;
      return (kick + hat + bass) * section * fade(t, 30);
    });
  })(),

  // A long crescendo of rumbling surf and a rising tone, then it drops away.
  offshore: (() => {
    const noise = random(3);
    let rumble = 0;
    return render(34, (t) => {
      const level = t < 22 ? (t / 22) ** 2 : t < 23.5 ? 1 : 0.22 + 0.12 * Math.sin((TAU * t) / 3);
      rumble += 0.05 * (noise() * 2 - 1 - rumble);
      const tone = Math.sin(TAU * (110 * t + 3 * t * t)) * 0.35;
      return (rumble * 3 + tone) * level * fade(t, 34);
    });
  })(),

  // Plucked arpeggios in eighth notes at 140 bpm, with a near-silent bar every fourth bar.
  "duck-dive": render(26, (t) => {
    const step = 60 / 140 / 2;
    const index = Math.floor(t / step);
    const local = t - index * step;
    const bar = Math.floor(index / 8);
    const freq = note([0, 4, 7, 12, 7, 4, 9, 7][index % 8] + (bar % 2 ? -5 : 0));
    const pluck = (Math.sin(TAU * freq * local) + 0.3 * Math.sin(TAU * freq * 2 * local)) * Math.exp(-local * 9);
    return pluck * (bar % 4 === 3 ? 0.06 : 1) * fade(t, 26);
  }),

  // One chord ringing out. Short enough for the auto-advance test.
  closeout: render(5, (t) => {
    const chord = Math.sin(TAU * note(0) * t) + Math.sin(TAU * note(4) * t) + Math.sin(TAU * note(7) * t);
    return chord * Math.exp(-t * 0.9) * fade(t, 5);
  }),
};

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** The loudest sample (sign kept) in each of `buckets` slices, the shape wavesurfer's peaks use. */
function peaks(samples, buckets = 1000) {
  const size = samples.length / buckets;
  const result = [];
  for (let b = 0; b < buckets; b++) {
    let loudest = 0;
    for (let i = Math.floor(b * size); i < Math.floor((b + 1) * size); i++) {
      if (Math.abs(samples[i]) > Math.abs(loudest)) loudest = samples[i];
    }
    result.push(Math.round(loudest * 1000) / 1000);
  }
  return result;
}

const durations = {};
for (const [name, samples] of Object.entries(tracks)) {
  writeFileSync(join(OUT, `${name}.wav`), wav(samples));
  durations[name] = samples.length / SAMPLE_RATE;
}
writeFileSync(
  join(OUT, "set-break.peaks.json"),
  JSON.stringify({ duration: durations["set-break"], peaks: [peaks(tracks["set-break"])] }),
);

// --- Background ----------------------------------------------------------------------

const WIDTH = 320;
const HEIGHT = 180;
const FRAMES = 36;

const mix = (a, b, k) => a.map((value, i) => value + (b[i] - value) * k);

/** A dusk seascape. Every motion term uses a whole multiple of `phase`, so the loop is seamless. */
function seascape(phase) {
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  const horizon = Math.round(HEIGHT * 0.46);
  const sunX = WIDTH * 0.66;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      let color;
      if (y < horizon) {
        color = mix([12, 38, 56], [238, 146, 92], (y / horizon) ** 1.7);
        const glow = Math.max(0, 1 - Math.hypot(x - sunX, y - horizon * 0.92) / 30);
        color = mix(color, [255, 228, 170], Math.min(1, glow * 1.6));
      } else {
        const depth = (y - horizon) / (HEIGHT - horizon);
        const swell =
          Math.sin(x * 0.04 + depth * 26 - phase * 2) * 0.55 +
          Math.sin(x * 0.11 - depth * 14 + phase * 3) * 0.3 +
          Math.sin(x * 0.023 + depth * 40 - phase) * 0.15;
        color = mix([28, 74, 92], [5, 22, 34], depth ** 0.8);
        if (swell > 0.45) color = mix(color, [120, 190, 196], (swell - 0.45) * 1.4);
        const glint = Math.max(0, 1 - Math.abs(x - sunX) / (14 + depth * 46)) * (1 - depth) ** 1.5;
        if (glint > 0 && swell > 0.1) color = mix(color, [255, 196, 128], Math.min(1, glint * swell * 2.2));
      }
      rgba.set([...color.map(Math.round), 255], (y * WIDTH + x) * 4);
    }
  }
  return rgba;
}

const frames = Array.from({ length: FRAMES }, (_, i) => seascape((TAU * i) / FRAMES));
const palette = quantize(frames[0], 256);
const gif = GIFEncoder();
for (const frame of frames) gif.writeFrame(applyPalette(frame, palette), WIDTH, HEIGHT, { palette, delay: 90 });
gif.finish();
writeFileSync(join(OUT, "waves.gif"), gif.bytes());

function png(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // no filter
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
writeFileSync(join(OUT, "waves-still.png"), png(WIDTH, HEIGHT, frames[0]));

writeFileSync(MANIFEST, JSON.stringify({ version: VERSION, durations }, null, 2));
console.log(`Demo assets written to ${OUT}`);
