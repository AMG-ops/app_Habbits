import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// In `npm run dev` the API lives in a sibling container; in production nginx
// proxies /api itself, so the app always talks to a same-origin /api.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/api": {
          target: env.API_UPSTREAM || "http://api:8000",
          changeOrigin: true,
        },
      },
    },
    build: { outDir: "dist", sourcemap: false },
  };
});
