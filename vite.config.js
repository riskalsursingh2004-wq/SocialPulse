import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // bind 0.0.0.0 so the sandbox preview can reach the dev server
    port: 5173,
    allowedHosts: true, // accept the sandbox preview proxy host
  },
})
