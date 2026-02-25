// import { vitePluginErrorOverlay } from "@hiogawa/vite-plugin-error-overlay";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
// import checker from "vite-plugin-checker";

// https://vitejs.dev/config/
export default defineConfig({
  cacheDir: ".vite",
  plugins: [
    react({
      babel: {
        plugins: ["styled-jsx/babel"],
      },
    }),
    tailwindcss(),
    // vitePluginErrorOverlay(),
    // checker({
    //   typescript: {
    //     buildMode: true,
    //     tsconfigPath: path.resolve(__dirname, "./tsconfig.json"),
    //   },
    // }),
    process.env.NODE_ENV === 'production' ? viteSingleFile() : null,
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
      },
    },
    hmr: {
      overlay: true,
    },
    watch: {
      ignored: ["**/*.tsbuildinfo"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      next: path.resolve(__dirname, "./src/components/next"),
      "next-themes": path.resolve(__dirname, "./src/next-themes.tsx"),
    },
  },
});
