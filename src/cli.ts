/// <reference types="node" />
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { peaksFromWav } from "./peaks";

const USAGE = `Usage: surfbort peaks <file.wav...> [--points <n>]

Writes <name>.peaks.json next to each WAV file, with the track's duration and
one channel of peaks: { "duration": 36.5, "peaks": [[0.12, 0.4, ...]] }.
Spread it into a track: { src, title, ...peaksJson }.

Options:
  --points <n>  Values per file (default: 800)
  --help        Show this message`;

interface Output {
  log(message: string): void;
  error(message: string): void;
}

/** Runs the `surfbort` command. Resolves to the exit code. */
export async function main(args: readonly string[], output: Output = console): Promise<number> {
  const [command, ...rest] = args;
  if (!command || command === "--help" || command === "-h") {
    output[command ? "log" : "error"](USAGE);
    return command ? 0 : 1;
  }
  if (command !== "peaks") {
    output.error(`Unknown command "${command}".\n\n${USAGE}`);
    return 1;
  }

  const files: string[] = [];
  let points = 800;
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    if (arg === "--help" || arg === "-h") {
      output.log(USAGE);
      return 0;
    } else if (arg === "--points" || arg.startsWith("--points=")) {
      const value = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : rest[++i];
      points = Number(value);
      if (!Number.isInteger(points) || points < 1) {
        output.error(`--points needs a positive whole number, not "${value ?? ""}".`);
        return 1;
      }
    } else if (arg.startsWith("-")) {
      output.error(`Unknown option "${arg}".\n\n${USAGE}`);
      return 1;
    } else {
      files.push(arg);
    }
  }
  if (!files.length) {
    output.error(`Name at least one WAV file.\n\n${USAGE}`);
    return 1;
  }

  let failed = false;
  for (const file of files) {
    try {
      const result = peaksFromWav(await readFile(file), { points });
      const out = join(dirname(file), `${basename(file, extname(file))}.peaks.json`);
      await writeFile(out, `${JSON.stringify(result)}\n`);
      output.log(`${out}: ${result.duration}s, ${points} points`);
    } catch (error) {
      failed = true;
      output.error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return failed ? 1 : 0;
}
