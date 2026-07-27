import { describe, it, expect, beforeEach } from 'vitest'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getGuestReports,
  getGuestToken,
  rememberGuestReport,
  updateGuestStatus,
} from './guestStore.js'

/**
 * A citizen who reports anonymously has no account to look their report up
 * with — the guest token stored here is the only way back to it. Losing this
 * list means losing access to the report permanently.
 */

beforeEach(() => AsyncStorage.__reset())

describe('remembering an anonymous report', () => {
  it('starts empty', async () => {
    expect(await getGuestReports()).toEqual([])
  })

  it('stores the report and its token', async () => {
    await rememberGuestReport({ id: 1, token: 'tok-1', description: 'چاله' })
    const [entry] = await getGuestReports()
    expect(entry.id).toBe(1)
    expect(entry.token).toBe('tok-1')
    expect(entry.description).toBe('چاله')
  })

  it('stamps each entry with an ISO save time', async () => {
    await rememberGuestReport({ id: 1, token: 'tok-1' })
    expect((await getGuestReports())[0].savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('puts the newest report first', async () => {
    await rememberGuestReport({ id: 1, token: 'a' })
    await rememberGuestReport({ id: 2, token: 'b' })
    expect((await getGuestReports()).map((r) => r.id)).toEqual([2, 1])
  })

  it('replaces rather than duplicates an existing report', async () => {
    await rememberGuestReport({ id: 1, token: 'old' })
    await rememberGuestReport({ id: 1, token: 'new' })
    const list = await getGuestReports()
    expect(list).toHaveLength(1)
    expect(list[0].token).toBe('new')
  })

  it('keeps at most 100 reports', async () => {
    for (let i = 0; i < 105; i += 1) {
      await rememberGuestReport({ id: i, token: `t${i}` })
    }
    expect(await getGuestReports()).toHaveLength(100)
  })

  it('drops the oldest entries when the cap is reached', async () => {
    for (let i = 0; i < 101; i += 1) {
      await rememberGuestReport({ id: i, token: `t${i}` })
    }
    const ids = (await getGuestReports()).map((r) => r.id)
    expect(ids).toContain(100)
    expect(ids).not.toContain(0)
  })

  it('survives corrupt storage without throwing', async () => {
    await AsyncStorage.setItem('guest_reports', 'not json')
    expect(await getGuestReports()).toEqual([])
  })
})

describe('looking a token back up', () => {
  it('finds the token for a known report', async () => {
    await rememberGuestReport({ id: 5, token: 'tok-5' })
    expect(await getGuestToken(5)).toBe('tok-5')
  })

  it('returns null for an unknown report', async () => {
    expect(await getGuestToken(999)).toBeNull()
  })

  it('returns null when nothing has been stored yet', async () => {
    expect(await getGuestToken(1)).toBeNull()
  })
})

describe('tracking status changes', () => {
  it('updates the cached status of one report', async () => {
    await rememberGuestReport({ id: 1, token: 'a', status: 'SUBMITTED' })
    await updateGuestStatus(1, 'IN_PROGRESS')
    expect((await getGuestReports())[0].status).toBe('IN_PROGRESS')
  })

  it('leaves the other reports untouched', async () => {
    await rememberGuestReport({ id: 1, token: 'a', status: 'SUBMITTED' })
    await rememberGuestReport({ id: 2, token: 'b', status: 'SUBMITTED' })
    await updateGuestStatus(1, 'RESOLVED')
    const byId = Object.fromEntries((await getGuestReports()).map((r) => [r.id, r.status]))
    expect(byId).toEqual({ 1: 'RESOLVED', 2: 'SUBMITTED' })
  })

  it('never drops the token while updating the status', async () => {
    await rememberGuestReport({ id: 1, token: 'tok-1', status: 'SUBMITTED' })
    await updateGuestStatus(1, 'CLOSED')
    expect(await getGuestToken(1)).toBe('tok-1')
  })

  it('updating an unknown report changes nothing', async () => {
    await rememberGuestReport({ id: 1, token: 'a', status: 'SUBMITTED' })
    await updateGuestStatus(99, 'CLOSED')
    expect((await getGuestReports())[0].status).toBe('SUBMITTED')
  })
})
