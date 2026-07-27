import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import * as FileSystem from 'expo-file-system/legacy'

vi.mock('./reports', () => ({ createReport: vi.fn() }))
vi.mock('./client', () => ({ pingServer: vi.fn() }))
vi.mock('./guestStore', () => ({ rememberGuestReport: vi.fn() }))

import { pingServer } from './client'
import { rememberGuestReport } from './guestStore'
import { createReport } from './reports'
import {
  checkServer,
  enqueueReport,
  getPendingCount,
  getPendingReports,
  removePending,
  subscribeQueue,
  subscribeServer,
  subscribeSyncing,
  syncQueue,
} from './offline.js'

/**
 * The mobile Offline-First outbox.
 *
 * Unlike the web queue this one is a dead-letter queue: an item that can never
 * succeed (too many attempts, too old, image purged by the OS) is dropped
 * rather than retried forever. These tests pin both halves — nothing is lost
 * while it can still be delivered, and nothing is retried after it cannot.
 */

const item = (overrides = {}) => ({
  description: 'چاله در خیابان',
  category: null,
  lat: 35.6892,
  lng: 51.389,
  accuracy: 12,
  capturedAt: '2026-07-27T10:00:00.000Z',
  integrityHash: 'a'.repeat(64),
  imageUri: 'file:///camera/tmp.jpg',
  ...overrides,
})

beforeEach(() => {
  AsyncStorage.__reset()
  NetInfo.__reset()
  FileSystem.__reset()
  FileSystem.__seed('file:///camera/tmp.jpg')
  vi.mocked(createReport).mockReset()
  vi.mocked(pingServer).mockReset()
  vi.mocked(rememberGuestReport).mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('enqueueing a capture', () => {
  it('starts with an empty queue', async () => {
    expect(await getPendingCount()).toBe(0)
  })

  it('queues a report', async () => {
    await enqueueReport(item())
    expect(await getPendingCount()).toBe(1)
  })

  it('copies the image out of the camera cache into durable storage', async () => {
    // The OS may purge the camera cache before connectivity returns.
    const entry = await enqueueReport(item())
    expect(entry.imageUri.startsWith(FileSystem.documentDirectory)).toBe(true)
    expect(FileSystem.__exists(entry.imageUri)).toBe(true)
  })

  it('preserves the bound location, timestamp and hash', async () => {
    await enqueueReport(item())
    const [queued] = await getPendingReports()
    expect(queued.lat).toBe(35.6892)
    expect(queued.lng).toBe(51.389)
    expect(queued.capturedAt).toBe('2026-07-27T10:00:00.000Z')
    expect(queued.integrityHash).toBe('a'.repeat(64))
  })

  it('stamps each entry with an id, a queue time and a zero attempt count', async () => {
    const entry = await enqueueReport(item())
    expect(entry.localId).toBeTruthy()
    expect(entry.queuedAt).toBeTruthy()
    expect(entry.attempts).toBe(0)
  })

  it('gives every entry a distinct id', async () => {
    const first = await enqueueReport(item())
    const second = await enqueueReport(item())
    expect(first.localId).not.toBe(second.localId)
  })

  it('falls back to the original uri if the copy fails', async () => {
    vi.spyOn(FileSystem, 'copyAsync').mockRejectedValueOnce(new Error('disk full'))
    const entry = await enqueueReport(item())
    expect(entry.imageUri).toBe('file:///camera/tmp.jpg')
  })

  it('persists across a restart, since the queue lives in AsyncStorage', async () => {
    await enqueueReport(item())
    expect(JSON.parse(AsyncStorage.__dump().pending_reports)).toHaveLength(1)
  })
})

describe('removing a queued report', () => {
  it('removes it by id and deletes its stored image', async () => {
    const entry = await enqueueReport(item())
    expect(await removePending(entry.localId)).toBe(true)
    expect(await getPendingCount()).toBe(0)
    expect(FileSystem.__exists(entry.imageUri)).toBe(false)
  })

  it('reports false for an unknown id', async () => {
    expect(await removePending('nope')).toBe(false)
  })

  it('leaves the other entries alone', async () => {
    const first = await enqueueReport(item({ description: 'اول' }))
    await enqueueReport(item({ description: 'دوم' }))
    await removePending(first.localId)
    const remaining = await getPendingReports()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].description).toBe('دوم')
  })
})

describe('flushing the queue', () => {
  it('does nothing when empty', async () => {
    expect(await syncQueue()).toEqual({ synced: 0, failed: 0, dropped: 0 })
    expect(createReport).not.toHaveBeenCalled()
  })

  it('uploads every queued report', async () => {
    createReport.mockResolvedValue({ id: 1, status: 'SUBMITTED' })
    await enqueueReport(item({ description: 'اول' }))
    await enqueueReport(item({ description: 'دوم' }))
    const result = await syncQueue()
    expect(result.synced).toBe(2)
    expect(await getPendingCount()).toBe(0)
  })

  it('keeps a failed report and counts an attempt', async () => {
    createReport.mockRejectedValue(new Error('offline'))
    await enqueueReport(item())
    const result = await syncQueue()
    expect(result).toMatchObject({ synced: 0, failed: 1, dropped: 0 })
    expect((await getPendingReports())[0].attempts).toBe(1)
  })

  it('a failing report does not block the others', async () => {
    createReport
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ id: 2, status: 'SUBMITTED' })
    await enqueueReport(item({ description: 'اول' }))
    await enqueueReport(item({ description: 'دوم' }))
    const result = await syncQueue()
    expect(result.synced).toBe(1)
    expect(result.failed).toBe(1)
  })

  it('deletes the stored image once a report is accepted', async () => {
    createReport.mockResolvedValue({ id: 1, status: 'SUBMITTED' })
    const entry = await enqueueReport(item())
    await syncQueue()
    expect(FileSystem.__exists(entry.imageUri)).toBe(false)
  })

  it('remembers the guest token of an anonymously filed report', async () => {
    createReport.mockResolvedValue({
      id: 7,
      status: 'SUBMITTED',
      guest_access_token: 'tok-7',
    })
    await enqueueReport(item({ description: 'ناشناس' }))
    await syncQueue()
    expect(rememberGuestReport).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, token: 'tok-7', description: 'ناشناس' }),
    )
  })

  it('does not record a guest token for a signed-in report', async () => {
    createReport.mockResolvedValue({ id: 7, status: 'SUBMITTED' })
    await enqueueReport(item())
    await syncQueue()
    expect(rememberGuestReport).not.toHaveBeenCalled()
  })

  it('skips a second flush while one is already running', async () => {
    // Both the connectivity listener and screen focus can trigger a flush, so
    // the guard is what stops a report being uploaded twice.
    let release
    createReport.mockImplementation(
      () => new Promise((resolve) => { release = () => resolve({ id: 1 }) }),
    )
    await enqueueReport(item())

    const first = syncQueue()
    // Wait until the upload is genuinely in flight before racing it.
    await vi.waitFor(() => expect(createReport).toHaveBeenCalled())

    const second = await syncQueue()
    expect(second.skipped).toBe(true)

    release()
    await first
  })

  it('a retry after connectivity returns clears the queue', async () => {
    createReport.mockRejectedValue(new Error('offline'))
    await enqueueReport(item())
    await syncQueue()

    createReport.mockReset()
    createReport.mockResolvedValue({ id: 1, status: 'SUBMITTED' })
    expect((await syncQueue()).synced).toBe(1)
    expect(await getPendingCount()).toBe(0)
  })
})

describe('dead-lettering — what is never retried again', () => {
  it('drops a report after six failed attempts', async () => {
    createReport.mockRejectedValue(new Error('offline'))
    await enqueueReport(item())
    for (let i = 0; i < 6; i += 1) await syncQueue()

    const result = await syncQueue()
    expect(result.dropped).toBe(1)
    expect(await getPendingCount()).toBe(0)
  })

  it('drops a report older than seven days', async () => {
    await enqueueReport(item())
    const queue = JSON.parse(AsyncStorage.__dump().pending_reports)
    queue[0].queuedAt = Date.now() - 8 * 24 * 60 * 60 * 1000
    await AsyncStorage.setItem('pending_reports', JSON.stringify(queue))

    const result = await syncQueue()
    expect(result.dropped).toBe(1)
    expect(createReport).not.toHaveBeenCalled()
  })

  it('keeps a report that is still inside the seven-day window', async () => {
    createReport.mockRejectedValue(new Error('offline'))
    await enqueueReport(item())
    const queue = JSON.parse(AsyncStorage.__dump().pending_reports)
    queue[0].queuedAt = Date.now() - 6 * 24 * 60 * 60 * 1000
    await AsyncStorage.setItem('pending_reports', JSON.stringify(queue))

    const result = await syncQueue()
    expect(result.dropped).toBe(0)
    expect(result.failed).toBe(1)
  })

  it('drops a report whose stored image the OS has purged', async () => {
    const entry = await enqueueReport(item())
    await FileSystem.deleteAsync(entry.imageUri)

    const result = await syncQueue()
    expect(result.dropped).toBe(1)
    expect(createReport).not.toHaveBeenCalled()
  })

  it('spends no network call on a report it is about to drop', async () => {
    await enqueueReport(item())
    const queue = JSON.parse(AsyncStorage.__dump().pending_reports)
    queue[0].attempts = 6
    await AsyncStorage.setItem('pending_reports', JSON.stringify(queue))

    await syncQueue()
    expect(createReport).not.toHaveBeenCalled()
  })
})

describe('queue subscriptions', () => {
  it('fires immediately with the current queue', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeQueue(listener)
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith([]))
    unsubscribe()
  })

  it('notifies on every mutation', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeQueue(listener)
    await vi.waitFor(() => expect(listener).toHaveBeenCalled())
    listener.mockClear()

    await enqueueReport(item())
    expect(listener).toHaveBeenCalledWith(expect.arrayContaining([expect.any(Object)]))
    unsubscribe()
  })

  it('stops notifying after unsubscribe', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeQueue(listener)
    await vi.waitFor(() => expect(listener).toHaveBeenCalled())
    unsubscribe()
    listener.mockClear()

    await enqueueReport(item())
    expect(listener).not.toHaveBeenCalled()
  })

  it('reports sync-in-progress state', async () => {
    createReport.mockResolvedValue({ id: 1 })
    const seen = []
    const unsubscribe = subscribeSyncing((value) => seen.push(value))
    await enqueueReport(item())
    await syncQueue()
    expect(seen).toEqual([false, true, false])
    unsubscribe()
  })
})

describe('server reachability', () => {
  it('reports no-network when the device is offline', async () => {
    NetInfo.__setState({ isConnected: false })
    expect(await checkServer()).toBe('no-network')
    expect(pingServer).not.toHaveBeenCalled()
  })

  it('reports online when the API answers', async () => {
    pingServer.mockResolvedValue(true)
    expect(await checkServer()).toBe('online')
  })

  it('distinguishes "server down" from "no internet"', async () => {
    pingServer.mockResolvedValue(false)
    expect(await checkServer()).toBe('server-down')
  })

  it('treats a probe that throws as server-down', async () => {
    pingServer.mockRejectedValue(new Error('boom'))
    expect(await checkServer()).toBe('server-down')
  })

  it('notifies subscribers immediately, then again with the probe result', async () => {
    pingServer.mockResolvedValue(true)
    const listener = vi.fn()
    const unsubscribe = subscribeServer(listener)
    // Fires synchronously with whatever the shared poller last knew, so the UI
    // never renders an empty indicator.
    expect(listener).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith('online'))
    unsubscribe()
  })

  it('flushes the queue as soon as the server comes back', async () => {
    pingServer.mockResolvedValue(true)
    createReport.mockResolvedValue({ id: 1, status: 'SUBMITTED' })
    await enqueueReport(item())

    const unsubscribe = subscribeServer(() => {})
    await vi.waitFor(async () => expect(await getPendingCount()).toBe(0))
    unsubscribe()
  })

  it('stops polling once the last subscriber leaves', async () => {
    pingServer.mockResolvedValue(true)
    const unsubscribe = subscribeServer(() => {})
    await vi.waitFor(() => expect(NetInfo.__listenerCount()).toBe(1))
    unsubscribe()
    expect(NetInfo.__listenerCount()).toBe(0)
  })
})
