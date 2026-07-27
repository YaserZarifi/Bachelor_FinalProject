/** Stand-in for @react-native-community/netinfo. */
let state = { isConnected: true, isInternetReachable: true }
const listeners = new Set()

const NetInfo = {
  async fetch() {
    return state
  },
  addEventListener(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  /** Test-only: change the reported connectivity and notify listeners. */
  __setState(next) {
    state = { ...state, ...next }
    for (const fn of listeners) fn(state)
  },
  __reset() {
    state = { isConnected: true, isInternetReachable: true }
    listeners.clear()
  },
  __listenerCount() {
    return listeners.size
  },
}

export default NetInfo
