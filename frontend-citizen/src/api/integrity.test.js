import { describe, it, expect } from 'vitest'
import { canonicalMeta, computeCaptureHash } from './integrity.js'

/**
 * The trusted-capture digest is the anti-fraud core of the proposal: it binds
 * the image bytes to the GPS fix and timestamp recorded at the same instant, so
 * swapping either afterwards becomes detectable.
 */

const META = {
  lat: 35.6892,
  lng: 51.389,
  capturedAt: '2026-07-27T10:00:00.000Z',
  accuracy: 12.4,
}

describe('canonicalMeta — a reproducible string form', () => {
  it('renders coordinates at a fixed six decimal places', () => {
    expect(canonicalMeta(META)).toBe('35.689200|51.389000|2026-07-27T10:00:00.000Z|12')
  })

  it('rounds the accuracy to whole metres', () => {
    expect(canonicalMeta({ ...META, accuracy: 12.6 })).toContain('|13')
  })

  it('marks a missing accuracy as "na" rather than dropping the field', () => {
    // Keeping the field present means the digest cannot be forged by simply
    // omitting the radius.
    expect(canonicalMeta({ ...META, accuracy: null })).toContain('|na')
    expect(canonicalMeta({ ...META, accuracy: undefined })).toContain('|na')
  })

  it('treats zero accuracy as a real value, not a missing one', () => {
    expect(canonicalMeta({ ...META, accuracy: 0 })).toContain('|0')
  })

  it('is stable across repeated calls', () => {
    expect(canonicalMeta(META)).toBe(canonicalMeta(META))
  })

  it('changes when the latitude changes', () => {
    expect(canonicalMeta({ ...META, lat: 35.6893 })).not.toBe(canonicalMeta(META))
  })

  it('changes when the timestamp changes', () => {
    expect(canonicalMeta({ ...META, capturedAt: '2026-07-27T10:00:01.000Z' })).not.toBe(
      canonicalMeta(META),
    )
  })

  it('ignores sub-micro-degree noise below the six-decimal precision', () => {
    expect(canonicalMeta({ ...META, lat: 35.68920001 })).toBe(canonicalMeta(META))
  })
})

describe('computeCaptureHash', () => {
  const image = () => new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/jpeg' })

  it('produces a 64-character lowercase hex SHA-256 digest', async () => {
    const hash = await computeCaptureHash(image(), META)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for identical inputs', async () => {
    expect(await computeCaptureHash(image(), META)).toBe(
      await computeCaptureHash(image(), META),
    )
  })

  it('changes when the image bytes change', async () => {
    const other = new Blob([new Uint8Array([9, 9, 9])], { type: 'image/jpeg' })
    expect(await computeCaptureHash(image(), META)).not.toBe(
      await computeCaptureHash(other, META),
    )
  })

  it('changes when the location changes — the photo cannot be relocated', async () => {
    expect(await computeCaptureHash(image(), META)).not.toBe(
      await computeCaptureHash(image(), { ...META, lat: 35.7 }),
    )
  })

  it('changes when the capture time changes', async () => {
    expect(await computeCaptureHash(image(), META)).not.toBe(
      await computeCaptureHash(image(), { ...META, capturedAt: '2020-01-01T00:00:00Z' }),
    )
  })

  it('changes when the reported accuracy changes', async () => {
    expect(await computeCaptureHash(image(), META)).not.toBe(
      await computeCaptureHash(image(), { ...META, accuracy: 99 }),
    )
  })

  it('handles an empty image without throwing', async () => {
    const hash = await computeCaptureHash(new Blob([]), META)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('fits the backend column, which is 64 characters wide', async () => {
    expect((await computeCaptureHash(image(), META)).length).toBe(64)
  })
})
