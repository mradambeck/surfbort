import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const src = (path: string) => fileURLToPath(new URL(`../src/${path}`, import.meta.url));
const publicDir = fileURLToPath(new URL("./public", import.meta.url));

/**
 * Serves public/ under /no-range the way hosts without byte-range support do (Cloudflare
 * Workers static assets, Cloudflare Pages): a Range request gets 200 and the whole file.
 */
function noRangeHost(): Plugin {
  return {
    name: "no-range-host",
    configureServer(server) {
      server.middlewares.use("/no-range", (req, res, next) => {
        const file = normalize(join(publicDir, decodeURIComponent((req.url ?? "/").split("?")[0]!)));
        if (!file.startsWith(publicDir)) return next();
        readFile(file).then(
          (body) => {
            res.writeHead(200, { "Content-Type": "audio/wav", "Content-Length": body.length });
            res.end(body);
          },
          () => next(),
        );
      });
    },
  };
}

// The playground imports the package by name, resolved to the source for live editing.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), noRangeHost()],
  resolve: {
    alias: [
      { find: /^surfbort\/styles\.css$/, replacement: src("styles.css") },
      { find: /^surfbort$/, replacement: src("index.ts") },
    ],
  },
});
