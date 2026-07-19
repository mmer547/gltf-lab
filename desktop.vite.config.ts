import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(projectRoot, "desktop"),
  base: "./",
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  build: {
    outDir: path.resolve(projectRoot, "desktop-dist"),
    emptyOutDir: true,
  },
});
