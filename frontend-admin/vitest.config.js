import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Test configuration for the staff dashboard SPA. */
export default defineConfig({
  plugins: [react()],
  // Test files live outside the app entry graph, so the automatic JSX runtime
  // has to be requested explicitly for them.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      // Scoped to the logic layer these tests target. Dashboard.jsx and the
      // other presentational modules are verified manually against the running
      // app (see the manual checklist in tests-reports/).
      include: [
        'src/api/**/*.js',
        'src/theme.js',
        'src/theme/**/*.jsx',
        'src/components/CountUp.jsx',
      ],
      exclude: ['src/**/*.test.{js,jsx}', 'src/test/**', 'src/main.jsx'],
    },
  },
})
