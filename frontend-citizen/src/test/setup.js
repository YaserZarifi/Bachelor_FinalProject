import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { webcrypto } from 'node:crypto'

// jsdom ships no WebCrypto, but the trusted-capture digest depends on
// `crypto.subtle`. Node's implementation is spec-compliant, so hand it over.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  })
}

// `fake-indexeddb` stores values through `structuredClone`, and Node cannot
// clone a *jsdom* Blob — it degrades to `{}`, which then makes
// `FormData.append(name, blob, filename)` throw. Passing Blobs through by
// reference keeps the offline queue's real code path exercisable. (Real
// IndexedDB stores a copy; for these tests the distinction does not matter.)
const nativeStructuredClone = globalThis.structuredClone
globalThis.structuredClone = function cloneWithBlobs(value) {
  if (value instanceof Blob) return value
  if (Array.isArray(value)) return value.map(cloneWithBlobs)
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneWithBlobs(item)]),
    )
  }
  return nativeStructuredClone(value)
}

// jsdom has no matchMedia; the theme provider reads it on mount.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
