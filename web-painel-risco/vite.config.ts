/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/painel-risco/",
  plugins: [react()],
  server: { port: 5174, proxy: { "/api": "http://localhost:5080" } },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/setupTestes.ts"] },
});
