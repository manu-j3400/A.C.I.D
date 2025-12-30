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
    viteSingleFile(),
  ],
  // server: {
  //   hmr: {
  //     overlay: true,
  //   },
  //   watch: {
  //     ignored: ["**/*.tsbuildinfo"],
  //   },
  // },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      next: path.resolve(__dirname, "./src/components/next"),
      "next-themes": path.resolve(__dirname, "./src/next-themes.tsx"),
    },
  },
});
