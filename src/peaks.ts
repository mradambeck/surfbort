/** A track's `duration` and `peaks`, ready to spread into a Track. */
export interface WavPeaks {
  /** Seconds, to the millisecond. */
  duration: number;
  /** One channel: the loudest sample in each slice, on any channel, from 0 to 1. */
  peaks: [number[]];
}

export interface WavPeaksOptions {
  /** How many values to compute. @default 800 */
  points?: number;
  /** Decimal places to keep, which keeps the JSON small. @default 2 */
  precision?: number;
}

const NOT_WAV =
  "Not a WAV file. The peaks generator reads WAV only, because other formats need a decoder. " +
  "Convert it first (for example, ffmpeg -i track.mp3 track.wav) or use audiowaveform.";

const PCM = 1;
const IEEE_FLOAT = 3;
const EXTENSIBLE = 0xfffe;

interface Format {
  tag: number;
  channels: number;
  sampleRate: number;
  bits: number;
}

/**
 * Computes waveform peaks from a WAV file's bytes: 8, 16, 24 or 32-bit PCM, or 32 or 64-bit
 * float, including WAVE_FORMAT_EXTENSIBLE. Works in Node and in the browser.
 */
export function peaksFromWav(wav: ArrayBuffer | ArrayBufferView, options: WavPeaksOptions = {}): WavPeaks {
  const { points = 800, precision = 2 } = options;
  if (!Number.isInteger(points) || points < 1) throw new RangeError(`points must be a positive integer, not ${points}`);
  const view = ArrayBuffer.isView(wav)
    ? new DataView(wav.buffer, wav.byteOffset, wav.byteLength)
    : new DataView(wav);
  if (view.byteLength < 12 || ascii(view, 0) !== "RIFF" || ascii(view, 8) !== "WAVE") throw new Error(NOT_WAV);

  let format: Format | undefined;
  let data: { start: number; end: number } | undefined;
  for (let at = 12; at + 8 <= view.byteLength; ) {
    const id = ascii(view, at);
    const size = view.getUint32(at + 4, true);
    if (id === "fmt " && size >= 16) {
      const tag = view.getUint16(at + 8, true);
      format = {
        // WAVE_FORMAT_EXTENSIBLE keeps the real format in the first two bytes of its sub-format GUID.
        tag: tag === EXTENSIBLE && size >= 40 ? view.getUint16(at + 32, true) : tag,
        channels: view.getUint16(at + 10, true),
        sampleRate: view.getUint32(at + 12, true),
        bits: view.getUint16(at + 22, true),
      };
    } else if (id === "data") {
      // Writers that stream sometimes leave the size at 0xFFFFFFFF.
      data = { start: at + 8, end: Math.min(at + 8 + size, view.byteLength) };
      break;
    }
    // Chunks are padded to an even length.
    at += 8 + size + (size % 2);
  }
  if (!format) throw new Error("No fmt chunk, so this isn't a valid WAV file.");
  if (!data) throw new Error("No data chunk, so this isn't a valid WAV file.");

  const { channels, sampleRate, bits } = format;
  if (!channels || !sampleRate) throw new Error("The fmt chunk lists no channels or no sample rate.");
  const read = sampleReader(view, format);
  const bytes = bits / 8;
  const frameBytes = bytes * channels;
  const frames = Math.floor((data.end - data.start) / frameBytes);

  const scale = 10 ** precision;
  const slice = frames / points;
  const peaks: number[] = [];
  for (let i = 0; i < points; i++) {
    let loudest = 0;
    const end = Math.min(Math.ceil((i + 1) * slice), frames);
    for (let frame = Math.floor(i * slice); frame < end; frame++) {
      const offset = data.start + frame * frameBytes;
      for (let channel = 0; channel < channels; channel++) {
        loudest = Math.max(loudest, Math.abs(read(offset + channel * bytes)));
      }
    }
    // Float files can go past full scale.
    peaks.push(Math.round(Math.min(loudest, 1) * scale) / scale);
  }

  return { duration: Math.round((frames / sampleRate) * 1000) / 1000, peaks: [peaks] };
}

function ascii(view: DataView, at: number): string {
  return String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));
}

/** Returns a function that reads one sample, scaled to -1…1, at a byte offset. */
function sampleReader(view: DataView, { tag, bits }: Format): (at: number) => number {
  if (tag === PCM) {
    switch (bits) {
      // 8-bit PCM is unsigned, centered on 128.
      case 8:
        return (at) => (view.getUint8(at) - 128) / 128;
      case 16:
        return (at) => view.getInt16(at, true) / 0x8000;
      case 24:
        return (at) => (((view.getUint8(at + 2) << 24) | (view.getUint8(at + 1) << 16) | (view.getUint8(at) << 8)) >> 8) / 0x800000;
      case 32:
        return (at) => view.getInt32(at, true) / 0x80000000;
    }
  } else if (tag === IEEE_FLOAT) {
    if (bits === 32) return (at) => view.getFloat32(at, true);
    if (bits === 64) return (at) => view.getFloat64(at, true);
  } else {
    throw new Error(
      `Compressed WAV (format tag ${tag}). The peaks generator reads uncompressed PCM or float. ` +
        "Convert it first (for example, ffmpeg -i track.wav -c:a pcm_s16le out.wav).",
    );
  }
  throw new Error(`Unsupported sample size: ${bits}-bit ${tag === PCM ? "PCM" : "float"}.`);
}
