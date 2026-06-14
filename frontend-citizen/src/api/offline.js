import { api } from './client'

/**
 * Offline-First queue for trusted captures.
 *
 * The proposal's guarantee is that a report captured in a network dead-zone is
 * stored locally *intact* and synced later without losing or altering its bound
 * location/timestamp. We keep the real image Blob plus its capture metadata in
 * IndexedDB (localStorage can't hold blobs and base64 bloats ~33%), and replay
 * the queue verbatim once connectivity returns.
 */

const DB_NAME = 'urbanhelper'
const DB_VERSION = 1
const STORE = 'pending_reports'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE)
}

/** List queued captures (without resolving blobs into URLs). */
export async function getPendingReports() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

export async function countPendingReports() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').count()
    req.onsuccess = () => resolve(req.result || 0)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Persist a capture package for later sync.
 * `capture` is the object emitted by <CameraCapture/>.
 */
export async function saveReportOffline({ category, description, capture }) {
  const db = await openDB()
  const item = {
    id: `${Date.now()}-${Math.round(performance.now())}`,
    category: category || null,
    description,
    blob: capture.blob, // IndexedDB stores Blobs natively
    lat: capture.lat,
    lng: capture.lng,
    accuracy: capture.accuracy,
    capturedAt: capture.capturedAt,
    integrityHash: capture.integrityHash,
    queuedAt: new Date().toISOString(),
  }
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').put(item)
    req.onsuccess = () => resolve(item)
    req.onerror = () => reject(req.error)
  })
}

async function deletePending(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** Build the multipart payload shared by online submit and offline sync. */
export function buildReportFormData(item) {
  const fd = new FormData()
  if (item.category) fd.append('category', item.category)
  fd.append('description', item.description)
  fd.append('location', `POINT(${item.lng} ${item.lat})`)
  fd.append('capture_source', 'CAMERA')
  fd.append('captured_at', item.capturedAt)
  if (item.accuracy != null) fd.append('gps_accuracy', Math.round(item.accuracy))
  if (item.integrityHash) fd.append('client_integrity_hash', item.integrityHash)
  fd.append('image_before', item.blob, 'capture.jpg')
  return fd
}

/** Attempt to sync every queued capture; keep failures in the queue. */
export async function syncReports() {
  const pending = await getPendingReports()
  const results = { synced: 0, failed: 0 }

  for (const item of pending) {
    try {
      await api.post('reports/', buildReportFormData(item), {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await deletePending(item.id)
      results.synced++
    } catch (err) {
      console.error('Sync failed for item', item.id, err)
      results.failed++
    }
  }
  return results
}
