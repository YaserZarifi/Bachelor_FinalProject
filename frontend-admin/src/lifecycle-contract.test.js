import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * Contract test: the dashboard only offers *legal* status moves.
 *
 * `ALLOWED_NEXT` and `STATUS_HEX` live inside `pages/Dashboard.jsx` and are not
 * exported, so they are read from the source instead of imported. That is
 * deliberate — the value of this test is catching the maps drifting away from
 * `reports/serializers.ALLOWED_STATUS_TRANSITIONS`, which would let a staff
 * member pick a transition the API then rejects with a 400.
 */

const SOURCE = readFileSync(
  resolve(process.cwd(), 'src/pages/Dashboard.jsx'),
  'utf8',
)

/** Pull an object literal out of the source by its variable name. */
function readObjectLiteral(name) {
  const start = SOURCE.indexOf(`const ${name} = {`)
  expect(start, `«${name}» در Dashboard.jsx پیدا نشد`).toBeGreaterThan(-1)
  const open = SOURCE.indexOf('{', start)
  let depth = 0
  for (let i = open; i < SOURCE.length; i += 1) {
    if (SOURCE[i] === '{') depth += 1
    if (SOURCE[i] === '}') {
      depth -= 1
      if (depth === 0) {
        // eslint-disable-next-line no-new-func
        return new Function(`return ${SOURCE.slice(open, i + 1)}`)()
      }
    }
  }
  throw new Error(`could not parse ${name}`)
}

// Mirrors backend `reports/serializers.py::ALLOWED_STATUS_TRANSITIONS`.
const BACKEND_TRANSITIONS = {
  SUBMITTED: ['UNDER_REVIEW', 'ASSIGNED'],
  UNDER_REVIEW: ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS'],
  ASSIGNED: ['IN_PROGRESS', 'UNDER_REVIEW'],
  IN_PROGRESS: ['RESOLVED', 'ASSIGNED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
}

const STATUSES = Object.keys(BACKEND_TRANSITIONS)

describe('ALLOWED_NEXT mirrors the backend state machine', () => {
  const allowedNext = readObjectLiteral('ALLOWED_NEXT')

  it('covers every status', () => {
    expect(Object.keys(allowedNext).sort()).toEqual([...STATUSES].sort())
  })

  it('offers exactly the transitions the API permits', () => {
    for (const status of STATUSES) {
      expect(new Set(allowedNext[status])).toEqual(new Set(BACKEND_TRANSITIONS[status]))
    }
  })

  it('offers nothing at all once a report is closed', () => {
    expect(allowedNext.CLOSED).toEqual([])
  })

  it('never offers a status as a move to itself', () => {
    for (const status of STATUSES) {
      expect(allowedNext[status]).not.toContain(status)
    }
  })

  it('never offers a status the backend does not know', () => {
    for (const targets of Object.values(allowedNext)) {
      for (const target of targets) expect(STATUSES).toContain(target)
    }
  })

  it('does not offer RESOLVED straight from SUBMITTED', () => {
    // Reaching RESOLVED requires an "after" photo, which is only collected
    // from IN_PROGRESS.
    expect(allowedNext.SUBMITTED).not.toContain('RESOLVED')
  })
})

describe('STATUS_HEX matches the shared palette', () => {
  const statusHex = readObjectLiteral('STATUS_HEX')

  it('colours every status', () => {
    expect(Object.keys(statusHex).sort()).toEqual([...STATUSES].sort())
  })

  it('uses valid hex colours', () => {
    for (const hex of Object.values(statusHex)) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('agrees with the citizen app on every status colour', () => {
    // Same incident must not appear amber on one screen and emerald on another.
    expect(statusHex).toEqual({
      SUBMITTED: '#0ea5e9',
      UNDER_REVIEW: '#38bdf8',
      ASSIGNED: '#f9b526',
      IN_PROGRESS: '#f2a20d',
      RESOLVED: '#10b981',
      CLOSED: '#64748b',
    })
  })
})

describe('toLatLng tolerates both geometry encodings', () => {
  // Extracted the same way, because the map depends on it and the backend
  // currently sends EWKT rather than GeoJSON.
  const source = SOURCE.slice(
    SOURCE.indexOf('function toLatLng('),
    SOURCE.indexOf('function pinIcon('),
  )
  // eslint-disable-next-line no-new-func
  const toLatLng = new Function(`${source}; return toLatLng`)()

  it('reads a GeoJSON geometry object and flips to Leaflet order', () => {
    expect(toLatLng({ type: 'Point', coordinates: [51.389, 35.6892] })).toEqual([
      35.6892, 51.389,
    ])
  })

  it('parses the EWKT string the API actually returns', () => {
    expect(toLatLng('SRID=4326;POINT (51.389 35.6892)')).toEqual([35.6892, 51.389])
  })

  it('parses a bare WKT point', () => {
    expect(toLatLng('POINT (51.389 35.6892)')).toEqual([35.6892, 51.389])
  })

  it('handles negative coordinates', () => {
    expect(toLatLng('POINT (-0.1276 51.5072)')).toEqual([51.5072, -0.1276])
  })

  it('returns null for a missing or unparsable geometry', () => {
    expect(toLatLng(null)).toBeNull()
    expect(toLatLng(undefined)).toBeNull()
    expect(toLatLng('LINESTRING (0 0, 1 1)')).toBeNull()
    expect(toLatLng({})).toBeNull()
  })
})
