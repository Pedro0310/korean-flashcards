import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': `http://localhost:${process.env.PORT ?? 3001}`,
    },
  },
  test: {
    include: ['server/**/*.test.ts', 'src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
