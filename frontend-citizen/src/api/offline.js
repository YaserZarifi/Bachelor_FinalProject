import { api } from './client'

const STORAGE_KEY = 'uh_pending_reports'

/** Get pending reports from localStorage */
export function getPendingReports() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/** Save a report locally for later sync */
export function saveReportOffline(reportData, imageFile) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const pending = getPendingReports()
      const newItem = {
        id: Date.now(), // temporary local ID
        data: reportData,
        image: reader.result, // base64 string
        timestamp: new Date().toISOString()
      }
      pending.push(newItem)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
      resolve(newItem)
    }
    reader.onerror = reject
    reader.readAsDataURL(imageFile)
  })
}

/** Attempt to sync all pending reports */
export async function syncReports() {
  const pending = getPendingReports()
  if (pending.length === 0) return { synced: 0, failed: 0 }

  const results = { synced: 0, failed: 0 }
  const stillPending = []

  for (const item of pending) {
    try {
      // Convert base64 back to blob
      const res = await fetch(item.image)
      const blob = await res.blob()
      
      const fd = new FormData()
      Object.entries(item.data).forEach(([k, v]) => {
        if (v) fd.append(k, v)
      })
      fd.append('image_before', blob, 'offline_report.jpg')

      await api.post('reports/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      results.synced++
    } catch (err) {
      console.error('Sync failed for item', item.id, err)
      stillPending.push(item)
      results.failed++
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(stillPending))
  return results
}
