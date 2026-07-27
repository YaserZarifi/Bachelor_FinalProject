/** Stand-in for expo-crypto, delegating to Node's WebCrypto for real digests. */
import { webcrypto } from 'node:crypto'

export const CryptoDigestAlgorithm = { SHA256: 'SHA-256' }

export async function digestStringAsync(algorithm, data) {
  const bytes = new TextEncoder().encode(data)
  const digest = await webcrypto.subtle.digest(algorithm, bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
