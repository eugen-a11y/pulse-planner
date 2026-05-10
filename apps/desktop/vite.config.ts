import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: "src/main/index.ts",
        vite: {
          build: {
            outDir: "dist-electron/main",
            rollupOptions: { external: ["electron", "better-sqlite3", "electron-updater"] },
          },
        },
      },
      preload: {
        input: "src/preload.ts",
        vite: {
          build: {
            outDir: "dist-electron/preload",
            rollupOptions: { output: { entryFileNames: "preload.js" } },
          },
        },
      },
      renderer: {},
    }),
  ],
  build: {
    outDir: "dist/renderer",
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        "quick-add": resolve(__dirname, "src/renderer/quick-add/index.html"),
      },
    },
  },
});
