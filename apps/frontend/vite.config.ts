import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// FixIt3D frontend - Vite configuration
// - host: true binds to 0.0.0.0 so the dev server is reachable through
//   GitHub Codespaces' automatic port forwarding.
// - The /api proxy forwards requests to the FastAPI backend running on
//   port 8000 inside the same Codespace, avoiding CORS issues entirely.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 5173,
  },
});
