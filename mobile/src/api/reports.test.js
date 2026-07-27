import { describe, it, expect } from 'vitest'
import { buildReportFormData } from './reports.js'

/**
 * The multipart payload the phone sends. It must agree field-for-field with
 * what `ReportSerializer` accepts, and with the web client's equivalent
 * builder — a mismatch shows up as a 400 the citizen cannot act on.
 */

const item = {
  description: 'چاله عمیق',
  category: 3,
  lat: 35.6892,
  lng: 51.389,
  accuracy: 12.4,
  capturedAt: '2026-07-27T10:00:00.000Z',
  integrityHash: 'b'.repeat(64),
  imageUri: 'file:///documents/pending/a.jpg',
}

describe('buildReportFormData', () => {
  it('encodes the location as WKT in lng-lat order', () => {
    expect(buildReportFormData(item).get('location')).toBe('POINT(51.389 35.6892)')
  })

  it('always declares the capture source as the in-app camera', () => {
    expect(buildReportFormData(item).get('capture_source')).toBe('CAMERA')
  })

  it('sends the description', () => {
    expect(buildReportFormData(item).get('description')).toBe('چاله عمیق')
  })

  it('sends the category as a string', () => {
    expect(buildReportFormData(item).get('category')).toBe('3')
  })

  it('omits the category when none was chosen', () => {
    expect(buildReportFormData({ ...item, category: null }).get('category')).toBeNull()
  })

  it('rounds the GPS accuracy to whole metres', () => {
    expect(buildReportFormData(item).get('gps_accuracy')).toBe('12')
    expect(buildReportFormData({ ...item, accuracy: 12.6 }).get('gps_accuracy')).toBe('13')
  })

  it('keeps a zero accuracy rather than treating it as missing', () => {
    expect(buildReportFormData({ ...item, accuracy: 0 }).get('gps_accuracy')).toBe('0')
  })

  it('omits the accuracy when it is unknown', () => {
    expect(buildReportFormData({ ...item, accuracy: null }).get('gps_accuracy')).toBeNull()
  })

  it('sends the capture timestamp', () => {
    expect(buildReportFormData(item).get('captured_at')).toBe('2026-07-27T10:00:00.000Z')
  })

  it('sends the integrity hash', () => {
    expect(buildReportFormData(item).get('client_integrity_hash')).toBe('b'.repeat(64))
  })

  it('omits the hash when none was computed', () => {
    expect(
      buildReportFormData({ ...item, integrityHash: '' }).get('client_integrity_hash'),
    ).toBeNull()
  })

  it('sends an empty description rather than "undefined"', () => {
    expect(buildReportFormData({ ...item, description: undefined }).get('description')).toBe('')
  })

  it('attaches the image as a React Native file descriptor', () => {
    // React Native's FormData accepts {uri, name, type} where the web needs a
    // Blob — this is the one place the two clients legitimately differ.
    const attached = buildReportFormData(item).get('image_before')
    expect(attached).toBeTruthy()
  })

  it('carries every field the backend serializer requires', () => {
    const fd = buildReportFormData(item)
    for (const field of [
      'description',
      'location',
      'capture_source',
      'captured_at',
      'gps_accuracy',
      'image_before',
    ]) {
      expect(fd.get(field), `فیلد «${field}» ارسال نشده`).not.toBeNull()
    }
  })
})
