import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const src = (path: string) => fileURLToPath(new URL(`../src/${path}`, import.meta.url));

// The playground imports the package by name, resolved to the source for live editing.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^surfbort\/styles\.css$/, replacement: src("styles.css") },
      { find: /^surfbort$/, replacement: src("index.ts") },
    ],
  },
});
