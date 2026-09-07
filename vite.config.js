import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split the big, rarely-changing vendor libraries (three.js, R3F/
        // drei, Rapier's WASM glue, Colyseus) into their own chunk so a
        // future app-code change doesn't force re-downloading them, and so
        // the browser can fetch/parse this chunk in parallel with the
        // (smaller) app bundle instead of one single ~3.4MB blocking file.
        manualChunks: {
          vendor: [
            "react",
            "react-dom",
            "three",
            "three-stdlib",
            "@react-three/fiber",
            "@react-three/drei",
            "@react-three/rapier",
            "@colyseus/sdk",
          ],
        },
      },
    },
  },
});
