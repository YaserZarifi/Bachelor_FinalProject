import { describe, it, expect, beforeEach } from 'vitest'
import * as FileSystem from 'expo-file-system/legacy'
import { computeCaptureHash } from './integrity.js'

/**
 * The native trusted-capture digest. It hashes base64(image) ‖ metaString
 * rather than the raw bytes the web app uses — the backend only *stores* the
 * value, so a self-consistent native scheme is sufficient and still binds the
 * photo to its coordinates and timestamp.
 */

const META = {
  lat: 35.6892,
  lng: 51.389,
  capturedAt: '2026-07-27T10:00:00.000Z',
  accuracy: 12.4,
}

const URI = 'file:///documents/pending/a.jpg'

beforeEach(() => {
  FileSystem.__reset()
  FileSystem.__seed(URI, 'aW1hZ2UtYnl0ZXM=')
})

describe('computeCaptureHash', () => {
  it('produces a 64-character lowercase hex digest', async () => {
    expect(await computeCaptureHash(URI, META)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for identical inputs', async () => {
    expect(await computeCaptureHash(URI, META)).toBe(await computeCaptureHash(URI, META))
  })

  it('changes when the image contents change', async () => {
    const first = await computeCaptureHash(URI, META)
    FileSystem.__seed(URI, 'ZGlmZmVyZW50')
    expect(await computeCaptureHash(URI, META)).not.toBe(first)
  })

  it('changes when the latitude changes — the photo cannot be relocated', async () => {
    expect(await computeCaptureHash(URI, META)).not.toBe(
      await computeCaptureHash(URI, { ...META, lat: 35.7 }),
    )
  })

  it('changes when the longitude changes', async () => {
    expect(await computeCaptureHash(URI, META)).not.toBe(
      await computeCaptureHash(URI, { ...META, lng: 51.4 }),
    )
  })

  it('changes when the capture time changes', async () => {
    expect(await computeCaptureHash(URI, META)).not.toBe(
      await computeCaptureHash(URI, { ...META, capturedAt: '2020-01-01T00:00:00.000Z' }),
    )
  })

  it('changes when the reported accuracy changes', async () => {
    expect(await computeCaptureHash(URI, META)).not.toBe(
      await computeCaptureHash(URI, { ...META, accuracy: 99 }),
    )
  })

  it('rounds the accuracy, so sub-metre jitter does not change the digest', async () => {
    expect(await computeCaptureHash(URI, { ...META, accuracy: 12.4 })).toBe(
      await computeCaptureHash(URI, { ...META, accuracy: 12.4001 }),
    )
  })

  it('treats a missing accuracy as zero rather than failing', async () => {
    expect(await computeCaptureHash(URI, { ...META, accuracy: null })).toMatch(
      /^[0-9a-f]{64}$/,
    )
  })

  it('still returns a digest when the image cannot be read', async () => {
    // A purged file must not break submission; the metadata alone still hashes.
    const hash = await computeCaptureHash('file:///gone.jpg', META)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('fits the backend column, which is 64 characters wide', async () => {
    expect((await computeCaptureHash(URI, META)).length).toBe(64)
  })
})
