/** In-memory stand-in for @react-native-async-storage/async-storage. */
const store = new Map()

const AsyncStorage = {
  async getItem(key) {
    return store.has(key) ? store.get(key) : null
  },
  async setItem(key, value) {
    store.set(key, String(value))
  },
  async removeItem(key) {
    store.delete(key)
  },
  async clear() {
    store.clear()
  },
  /** Test-only helper. */
  __reset() {
    store.clear()
  },
  /** Test-only helper: inspect raw contents. */
  __dump() {
    return Object.fromEntries(store)
  },
}

export default AsyncStorage
