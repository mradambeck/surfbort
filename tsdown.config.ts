import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "neutral",
  target: "es2022",
  dts: true,
  sourcemap: true,
  // Every export renders on the client, so the whole bundle is a Next.js client module.
  banner: { js: '"use client";' },
  copy: [{ from: "src/styles.css" }],
  publint: { level: "error" },
  // attw checks type resolution, which a stylesheet doesn't have.
  attw: { profile: "esm-only", level: "error", excludeEntrypoints: ["./styles.css"] },
});
