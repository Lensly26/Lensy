import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/",
  envDir: "../../",
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 1600,
  },
  envPrefix: ["VITE_"],
});