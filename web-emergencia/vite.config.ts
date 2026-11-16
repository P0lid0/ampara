/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  envPrefix: ["VITE_", "EXPO_PUBLIC_"],
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5080",
      "/hubs": { target: "http://localhost:5080", ws: true },
    },
  },
  test: { environment: "jsdom", globals: true, setupFiles: ["./vitest.setup.ts"] },
});
