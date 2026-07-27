import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Test configuration for the citizen SPA.
 *
 * Kept separate from `vite.config.js` so the dev/build pipeline stays untouched.
 * Run with `npm test` (watch) or `npm run test:run` (single pass, for CI).
 */
export default defineConfig({
  plugins: [react()],
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
      // Scoped to the logic layer these tests target. Presentational
      // components and pages are verified manually against the running app
      // (see the manual checklist in tests-reports/), so folding them into the
      // denominator would only make the figure meaningless.
      include: ['src/api/**/*.js', 'src/hooks/**/*.js', 'src/lib/**/*.js'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/test/**', 'src/main.jsx'],
    },
  },
})
