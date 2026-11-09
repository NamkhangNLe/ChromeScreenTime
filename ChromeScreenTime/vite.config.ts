import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the built popup works when loaded as an
  // unpacked extension (chrome-extension://<id>/...), not just on a server.
  base: './',
})
