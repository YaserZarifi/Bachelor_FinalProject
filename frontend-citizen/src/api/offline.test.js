import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./client.js', () => ({ api: { post: vi.fn() } }))

import { api } from './client.js'
import {
  buildReportFormData,
  countPendingReports,
  getPendingReports,
  saveReportOffline,
  syncReports,
} from './offline.js'

/**
 * The Offline-First guarantee from the proposal: a report captured in a network
 * dead-zone is stored locally *intact* — image bytes, coordinates, timestamp and
 * integrity hash — and replayed verbatim once connectivity returns.
 */

const capture = (overrides = {}) => ({
  blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
  lat: 35.6892,
  lng: 51.389,
  accuracy: 12.4,
  capturedAt: '2026-07-27T10:00:00.000Z',
  integrityHash: 'a'.repeat(64),
  ...overrides,
})

beforeEach(() => {
  // `offline.js` opens a connection per call and never closes it, so
  // `deleteDatabase` would block forever. Swapping in a brand-new in-memory
  // factory gives each test a clean queue without needing to close anything.
  globalThis.indexedDB = new IDBFactory()
  vi.mocked(api.post).mockReset()

  // Queue keys are `${Date.now()}-${Math.round(performance.now())}`, so two
  // saves inside the same millisecond produce the same key. Forcing the clock
  // forward keeps every other test deterministic; the collision itself is
  // pinned separately in "known issues" below.
  let tick = 0
  vi.spyOn(performance, 'now').mockImplementation(() => (tick += 1))
})

describe('queueing a capture', () => {
  it('starts with an empty queue', async () => {
    expect(await countPendingReports()).toBe(0)
  })

  it('stores a capture for later', async () => {
    await saveReportOffline({ description: 'چاله', category: null, capture: capture() })
    expect(await countPendingReports()).toBe(1)
  })

  it('keeps the image as a real Blob rather than base64', async () => {
    await saveReportOffline({ description: 'چاله', capture: capture() })
    const [item] = await getPendingReports()
    expect(item.blob).toBeInstanceOf(Blob)
    expect(item.blob.size).toBe(3)
  })

  it('preserves the bound location and timestamp exactly', async () => {
    await saveReportOffline({ description: 'چاله', capture: capture() })
    const [item] = await getPendingReports()
    expect(item.lat).toBe(35.6892)
    expect(item.lng).toBe(51.389)
    expect(item.capturedAt).toBe('2026-07-27T10:00:00.000Z')
    expect(item.accuracy).toBe(12.4)
  })

  it('preserves the integrity hash', async () => {
    await saveReportOffline({ description: 'چاله', capture: capture() })
    expect((await getPendingReports())[0].integrityHash).toBe('a'.repeat(64))
  })

  it('records when the item was queued', async () => {
    await saveReportOffline({ description: 'چاله', capture: capture() })
    expect((await getPendingReports())[0].queuedAt).toBeTruthy()
  })

  it('normalises a missing category to null', async () => {
    await saveReportOffline({ description: 'چاله', capture: capture() })
    expect((await getPendingReports())[0].category).toBeNull()
  })

  it('keeps a chosen category', async () => {
    await saveReportOffline({ description: 'چاله', category: 3, capture: capture() })
    expect((await getPendingReports())[0].category).toBe(3)
  })

  it('gives every queued item a distinct id', async () => {
    await saveReportOffline({ description: 'اول', capture: capture() })
    await saveReportOffline({ description: 'دوم', capture: capture() })
    const items = await getPendingReports()
    expect(new Set(items.map((i) => i.id)).size).toBe(2)
  })

  it('queues several captures independently', async () => {
    await saveReportOffline({ description: 'اول', capture: capture() })
    await saveReportOffline({ description: 'دوم', capture: capture() })
    expect(await countPendingReports()).toBe(2)
  })
})

describe('known issues', () => {
  it('⚠️ two captures queued in the same millisecond overwrite each other', async () => {
    // `saveReportOffline` derives its IndexedDB key from
    // `${Date.now()}-${Math.round(performance.now())}` — both millisecond
    // resolution. Two captures saved inside the same millisecond therefore get
    // the same key, and `put` silently replaces the first: one report is lost
    // before it is ever uploaded.
    //
    // A collision-free key (e.g. `crypto.randomUUID()`) fixes it. Until then,
    // this test documents the data-loss window; it must be inverted once the
    // key generation changes.
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000)
    vi.spyOn(performance, 'now').mockReturnValue(42)

    await saveReportOffline({ description: 'گزارش اول', capture: capture() })
    await saveReportOffline({ description: 'گزارش دوم', capture: capture() })

    expect(await countPendingReports()).toBe(1)
    expect((await getPendingReports())[0].description).toBe('گزارش دوم')
  })
})

describe('buildReportFormData — the multipart payload', () => {
  const item = {
    description: 'چاله عمیق',
    category: 3,
    lat: 35.6892,
    lng: 51.389,
    accuracy: 12.4,
    capturedAt: '2026-07-27T10:00:00.000Z',
    integrityHash: 'b'.repeat(64),
    blob: new Blob([new Uint8Array([1])], { type: 'image/jpeg' }),
  }

  it('encodes the location as WKT in lng-lat order', () => {
    expect(buildReportFormData(item).get('location')).toBe('POINT(51.389 35.6892)')
  })

  it('always declares the capture source as the in-app camera', () => {
    expect(buildReportFormData(item).get('capture_source')).toBe('CAMERA')
  })

  it('sends the description and category', () => {
    const fd = buildReportFormData(item)
    expect(fd.get('description')).toBe('چاله عمیق')
    expect(fd.get('category')).toBe('3')
  })

  it('rounds the GPS accuracy to whole metres for the backend gate', () => {
    expect(buildReportFormData(item).get('gps_accuracy')).toBe('12')
  })

  it('sends the capture timestamp and integrity hash', () => {
    const fd = buildReportFormData(item)
    expect(fd.get('captured_at')).toBe('2026-07-27T10:00:00.000Z')
    expect(fd.get('client_integrity_hash')).toBe('b'.repeat(64))
  })

  it('attaches the image under the field the API expects', () => {
    expect(buildReportFormData(item).get('image_before')).toBeTruthy()
  })

  it('omits the category when none was chosen', () => {
    expect(buildReportFormData({ ...item, category: null }).get('category')).toBeNull()
  })

  it('omits the accuracy when it is unknown', () => {
    expect(buildReportFormData({ ...item, accuracy: null }).get('gps_accuracy')).toBeNull()
  })

  it('keeps a zero accuracy rather than treating it as missing', () => {
    expect(buildReportFormData({ ...item, accuracy: 0 }).get('gps_accuracy')).toBe('0')
  })

  it('omits the hash when none was computed', () => {
    expect(
      buildReportFormData({ ...item, integrityHash: '' }).get('client_integrity_hash'),
    ).toBeNull()
  })
})

describe('syncReports — replaying the queue', () => {
  it('does nothing when the queue is empty', async () => {
    expect(await syncReports()).toEqual({ synced: 0, failed: 0 })
    expect(api.post).not.toHaveBeenCalled()
  })

  it('uploads every queued capture', async () => {
    api.post.mockResolvedValue({ data: {} })
    await saveReportOffline({ description: 'اول', capture: capture() })
    await saveReportOffline({ description: 'دوم', capture: capture() })
    const result = await syncReports()
    expect(result.synced).toBe(2)
    expect(api.post).toHaveBeenCalledTimes(2)
  })

  it('posts to the reports endpoint as multipart', async () => {
    api.post.mockResolvedValue({ data: {} })
    await saveReportOffline({ description: 'چاله', capture: capture() })
    await syncReports()
    const [url, , config] = api.post.mock.calls[0]
    expect(url).toBe('reports/')
    expect(config.headers['Content-Type']).toBe('multipart/form-data')
  })

  it('removes an item from the queue once it is accepted', async () => {
    api.post.mockResolvedValue({ data: {} })
    await saveReportOffline({ description: 'چاله', capture: capture() })
    await syncReports()
    expect(await countPendingReports()).toBe(0)
  })

  it('keeps an item in the queue when the upload fails', async () => {
    api.post.mockRejectedValue(new Error('offline'))
    await saveReportOffline({ description: 'چاله', capture: capture() })
    const result = await syncReports()
    expect(result).toEqual({ synced: 0, failed: 1 })
    expect(await countPendingReports()).toBe(1)
  })

  it('a failing item does not block the others', async () => {
    api.post.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: {} })
    await saveReportOffline({ description: 'اول', capture: capture() })
    await saveReportOffline({ description: 'دوم', capture: capture() })
    const result = await syncReports()
    expect(result.synced).toBe(1)
    expect(result.failed).toBe(1)
    expect(await countPendingReports()).toBe(1)
  })

  it('a retry after connectivity returns clears the queue', async () => {
    api.post.mockRejectedValue(new Error('offline'))
    await saveReportOffline({ description: 'چاله', capture: capture() })
    await syncReports()

    api.post.mockReset()
    api.post.mockResolvedValue({ data: {} })
    expect((await syncReports()).synced).toBe(1)
    expect(await countPendingReports()).toBe(0)
  })

  it('sends the stored capture metadata verbatim, not re-derived values', async () => {
    api.post.mockResolvedValue({ data: {} })
    await saveReportOffline({ description: 'چاله', capture: capture() })
    await syncReports()
    const formData = api.post.mock.calls[0][1]
    expect(formData.get('location')).toBe('POINT(51.389 35.6892)')
    expect(formData.get('captured_at')).toBe('2026-07-27T10:00:00.000Z')
    expect(formData.get('client_integrity_hash')).toBe('a'.repeat(64))
  })
})
