import { describe, it, expect } from 'vitest'
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER, statusIndex } from './status.js'

/**
 * The lifecycle as the phone renders it. This is the fourth copy of the same
 * list (backend model, citizen SPA, admin dashboard, here), so these tests
 * exist to catch it drifting.
 */

const BACKEND_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
]

const BACKEND_LABELS = {
  SUBMITTED: 'ثبت شده',
  UNDER_REVIEW: 'در حال بررسی',
  ASSIGNED: 'ارجاع داده‌شده',
  IN_PROGRESS: 'در حال اقدام',
  RESOLVED: 'حل‌شده',
  CLOSED: 'مختومه',
}

describe('STATUS_ORDER', () => {
  it('matches the backend lifecycle exactly, in order', () => {
    expect(STATUS_ORDER).toEqual(BACKEND_STATUSES)
  })

  it('contains no duplicates', () => {
    expect(new Set(STATUS_ORDER).size).toBe(STATUS_ORDER.length)
  })
})

describe('STATUS_LABEL', () => {
  it('labels every status', () => {
    expect(Object.keys(STATUS_LABEL).sort()).toEqual([...BACKEND_STATUSES].sort())
  })

  it('uses the same Persian wording as the backend and the push worker', () => {
    expect(STATUS_LABEL).toEqual(BACKEND_LABELS)
  })
})

describe('STATUS_COLOR', () => {
  it('colours every status', () => {
    expect(Object.keys(STATUS_COLOR).sort()).toEqual([...BACKEND_STATUSES].sort())
  })

  it('uses valid hex colours', () => {
    for (const [status, hex] of Object.entries(STATUS_COLOR)) {
      expect(hex, status).toMatch(/^#[0-9a-f]{3,8}$/i)
    }
  })

  it('agrees with the web clients on resolved and in-progress', () => {
    expect(STATUS_COLOR.RESOLVED.toLowerCase()).toBe('#10b981')
    expect(STATUS_COLOR.IN_PROGRESS.toLowerCase()).toBe('#f2a20d')
  })
})

describe('statusIndex', () => {
  it('positions each status on the timeline', () => {
    expect(statusIndex('SUBMITTED')).toBe(0)
    expect(statusIndex('IN_PROGRESS')).toBe(3)
    expect(statusIndex('CLOSED')).toBe(5)
  })

  it('clamps an unknown status to the start instead of returning −1', () => {
    // The timeline component indexes an array with this value, so a negative
    // index would render nothing at all.
    expect(statusIndex('TELEPORTED')).toBe(0)
    expect(statusIndex(undefined)).toBe(0)
  })

  it('increases monotonically along the lifecycle', () => {
    const indices = STATUS_ORDER.map(statusIndex)
    expect(indices).toEqual([...indices].sort((a, b) => a - b))
  })
})
