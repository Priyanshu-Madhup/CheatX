import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_WITY_BASE_URL || "https://wity-proxy-production-2c33.up.railway.app";
  const key = env.WITY_API_KEY || env.VITE_WITY_API_KEY;

  return {
    plugins: [react()],
    server: {
      // Dev equivalent of api/wity.js
      proxy: {
        "/api/wity": {
          target,
          changeOrigin: true,
          rewrite: () => "/v1/systemone",
          headers: { Authorization: `Bearer ${key}` },
        },
      },
    },
  };
});
