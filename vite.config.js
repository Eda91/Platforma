
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/Platforma/",
  plugins: [react()],
  server: {
    proxy: {
      "/Platforma/api/doortodoor": {
        target: "https://ashk-doortodoor-api.onrender.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/Platforma/, ""),
        headers: {
          Origin: "https://eda91.github.io",
        },
      },
    },
  },
});
