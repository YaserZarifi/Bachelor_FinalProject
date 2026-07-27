/** Stand-in for expo-location. */
export const Accuracy = { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5 }

let permission = { status: 'granted' }
let servicesEnabled = true

export async function requestForegroundPermissionsAsync() {
  return permission
}

export async function hasServicesEnabledAsync() {
  return servicesEnabled
}

export async function watchPositionAsync() {
  return { remove() {} }
}

export async function getCurrentPositionAsync() {
  return {
    coords: { latitude: 35.6892, longitude: 51.389, accuracy: 10, mocked: false },
    timestamp: Date.UTC(2026, 6, 27, 10, 0, 0),
  }
}

/** Test-only helpers. */
export function __setPermission(status) {
  permission = { status }
}
export function __setServicesEnabled(value) {
  servicesEnabled = value
}
export function __reset() {
  permission = { status: 'granted' }
  servicesEnabled = true
}
