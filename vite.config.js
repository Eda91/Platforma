import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/Platforma/',
  plugins: [react()],

  server: {
    proxy: {
      '/Platforma/api/doortodoor': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/Platforma/, ''),
      },
    },
  },
})