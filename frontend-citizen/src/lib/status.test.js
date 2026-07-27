import { describe, it, expect } from 'vitest'
import { STATUS_META, STATUS_ORDER, statusIndex, statusMeta } from './status.js'

/**
 * The report lifecycle as the citizen sees it — the "civic line" of stations.
 * This list is duplicated in four places (backend model, both SPAs, the mobile
 * app), so these tests exist mainly to catch it drifting out of sync.
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

  it('starts at SUBMITTED and ends at CLOSED', () => {
    expect(STATUS_ORDER[0]).toBe('SUBMITTED')
    expect(STATUS_ORDER.at(-1)).toBe('CLOSED')
  })

  it('contains no duplicates', () => {
    expect(new Set(STATUS_ORDER).size).toBe(STATUS_ORDER.length)
  })
})

describe('STATUS_META', () => {
  it('describes every status', () => {
    expect(Object.keys(STATUS_META).sort()).toEqual([...BACKEND_STATUSES].sort())
  })

  it('uses the same Persian labels as the backend', () => {
    for (const status of BACKEND_STATUSES) {
      expect(STATUS_META[status].label).toBe(BACKEND_LABELS[status])
    }
  })

  it('gives every status an icon, a hex colour and chip classes', () => {
    for (const status of BACKEND_STATUSES) {
      const meta = STATUS_META[status]
      expect(meta.icon).toBeTruthy()
      expect(meta.hex).toMatch(/^#[0-9a-f]{6}$/i)
      expect(meta.dot).toBeTruthy()
      expect(meta.chip).toBeTruthy()
    }
  })

  it('styles every chip for both light and dark mode', () => {
    for (const status of BACKEND_STATUSES) {
      expect(STATUS_META[status].chip).toContain('dark:')
    }
  })

  it('colours RESOLVED with the civic emerald', () => {
    expect(STATUS_META.RESOLVED.hex).toBe('#10b981')
  })

  it('gives closed reports a muted slate colour', () => {
    expect(STATUS_META.CLOSED.hex).toBe('#64748b')
  })
})

describe('statusMeta', () => {
  it('returns the entry for a known status', () => {
    expect(statusMeta('RESOLVED').label).toBe('حل‌شده')
  })

  it('falls back to SUBMITTED for an unknown status', () => {
    expect(statusMeta('TELEPORTED')).toBe(STATUS_META.SUBMITTED)
  })

  it('falls back for null and undefined', () => {
    expect(statusMeta(null)).toBe(STATUS_META.SUBMITTED)
    expect(statusMeta(undefined)).toBe(STATUS_META.SUBMITTED)
  })
})

describe('statusIndex', () => {
  it('positions each status on the line', () => {
    expect(statusIndex('SUBMITTED')).toBe(0)
    expect(statusIndex('IN_PROGRESS')).toBe(3)
    expect(statusIndex('CLOSED')).toBe(5)
  })

  it('returns −1 for an unknown status', () => {
    expect(statusIndex('TELEPORTED')).toBe(-1)
  })

  it('increases monotonically along the lifecycle', () => {
    const indices = STATUS_ORDER.map(statusIndex)
    expect(indices).toEqual([...indices].sort((a, b) => a - b))
  })
})
