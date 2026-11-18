import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev me proxy use karte hain taaki CORS ka jhanjhat na ho.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/auth-api': {
        target: 'https://usermanagementms.ajeevi.in',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/auth-api/, ''),
      },
      '/ticket-api': {
        target: 'https://ticketmanagementms.ajeevi.in',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/ticket-api/, ''),
      },
      '/device-api': {
        target: 'https://devicemanagementms.ajeevi.in',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/device-api/, ''),
      },
    },
  },
})
