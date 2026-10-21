import { defineConfig } from "tsdown";

const shared = { format: "esm", sourcemap: true, fixedExtension: false } as const;

export default defineConfig([
  {
    ...shared,
    entry: ["src/index.ts"],
    platform: "neutral",
    target: "es2022",
    dts: true,
    // Every export renders on the client, so the whole bundle is a Next.js client module.
    banner: { js: '"use client";' },
    copy: [{ from: "src/styles.css" }],
  },
  {
    // The peaks generator, for build scripts. It runs anywhere, so it isn't a client module.
    ...shared,
    entry: ["src/peaks.ts"],
    platform: "neutral",
    target: "es2022",
    dts: true,
  },
  {
    // The `surfbort` command. Checks run last, once every entry point exists.
    ...shared,
    entry: { cli: "src/bin.ts" },
    platform: "node",
    target: "node20",
    dts: false,
    publint: { level: "error" },
    // attw checks type resolution, which a stylesheet doesn't have.
    attw: { profile: "esm-only", level: "error", excludeEntrypoints: ["./styles.css"] },
  },
]);
