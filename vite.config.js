import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.js', 'src/components/**/*.{js,jsx}', 'src/App.jsx'],
      thresholds: {
        lines: 65,
        branches: 60,
        statements: 65,
      },
    },
  },
})
