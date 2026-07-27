import { defineConfig } from 'vite'
import { resolve } from 'node:path'

/**
 * Test configuration for the Expo citizen app.
 *
 * The app's *logic* layer (API client, offline outbox, guest-token store,
 * status constants) is plain JavaScript and is what these tests exercise. The
 * native modules it imports cannot run under Node, so each is aliased to a
 * hand-written double in `src/test/mocks/` — that also keeps resolution
 * independent of Expo's subpath exports (`expo-file-system/legacy`).
 *
 * Screens and React Native components are out of scope here; they are verified
 * on-device (see the manual test checklist in the test report).
 */
const mock = (name) => resolve(process.cwd(), 'src/test/mocks', name)

export default defineConfig({
  resolve: {
    alias: {
      '@react-native-async-storage/async-storage': mock('async-storage.js'),
      '@react-native-community/netinfo': mock('netinfo.js'),
      'expo-secure-store': mock('secure-store.js'),
      'expo-file-system/legacy': mock('file-system.js'),
      'expo-crypto': mock('crypto.js'),
      'expo-location': mock('location.js'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.js'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/api/**/*.js', 'src/constants/**/*.js'],
      exclude: ['src/**/*.test.js', 'src/test/**'],
    },
  },
})
