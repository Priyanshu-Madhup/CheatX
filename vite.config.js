import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const wityTarget = env.VITE_WITY_BASE_URL || "https://wity-proxy-production-2c33.up.railway.app";
  const wityKey = env.WITY_API_KEY || env.VITE_WITY_API_KEY;

  return {
    plugins: [react()],
    server: {
      // Dev equivalents of api/wity.js and api/openrouter.js
      proxy: {
        "/api/wity": {
          target: wityTarget,
          changeOrigin: true,
          rewrite: () => "/v1/systemone",
          headers: { Authorization: `Bearer ${wityKey}` },
        },
        "/api/openrouter": {
          target: "https://openrouter.ai",
          changeOrigin: true,
          rewrite: () => "/api/v1/chat/completions",
          headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
        },
      },
    },
  };
});
