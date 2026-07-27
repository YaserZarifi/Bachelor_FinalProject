/** Stand-in for expo-file-system/legacy, backed by an in-memory file table. */
export const documentDirectory = 'file:///documents/'

const files = new Map()

export const EncodingType = { Base64: 'base64', UTF8: 'utf8' }

export async function makeDirectoryAsync() {
  /* directories are implicit in the in-memory table */
}

export async function copyAsync({ from, to }) {
  files.set(to, files.get(from) ?? 'image-bytes')
}

export async function deleteAsync(uri) {
  files.delete(uri)
}

export async function getInfoAsync(uri) {
  return { exists: files.has(uri), uri }
}

export async function readAsStringAsync(uri) {
  if (!files.has(uri)) throw new Error(`file not found: ${uri}`)
  return files.get(uri)
}

/** Test-only helpers. */
export function __seed(uri, contents = 'image-bytes') {
  files.set(uri, contents)
}
export function __exists(uri) {
  return files.has(uri)
}
export function __reset() {
  files.clear()
}
