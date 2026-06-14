/**
 * Trusted-capture integrity digest.
 *
 * Binds the captured image bytes to the GPS coordinates + timestamp that were
 * recorded at the same instant, producing a SHA-256 fingerprint. The fingerprint
 * travels with the report so any later tampering with the image or its location
 * becomes detectable. (The server stores it as an audit fingerprint; it can also
 * recompute and verify it as a future hardening step.)
 */

/** Canonical, reproducible string form of the capture metadata. */
export function canonicalMeta({ lat, lng, capturedAt, accuracy }) {
  const acc = accuracy == null ? 'na' : String(Math.round(accuracy))
  return `${Number(lat).toFixed(6)}|${Number(lng).toFixed(6)}|${capturedAt}|${acc}`
}

/** SHA-256 over (image bytes ‖ canonical metadata bytes) → lowercase hex. */
export async function computeCaptureHash(imageBlob, meta) {
  const imageBuf = await imageBlob.arrayBuffer()
  const metaBuf = new TextEncoder().encode(canonicalMeta(meta))

  const combined = new Uint8Array(imageBuf.byteLength + metaBuf.byteLength)
  combined.set(new Uint8Array(imageBuf), 0)
  combined.set(metaBuf, imageBuf.byteLength)

  const digest = await crypto.subtle.digest('SHA-256', combined)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
