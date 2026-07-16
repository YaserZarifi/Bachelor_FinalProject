import { api, flattenFeature, flattenFeatures } from './client';

export async function fetchCategories() {
  const res = await api.get('categories/');
  return res.data;
}

export async function fetchMyReports() {
  const res = await api.get('reports/');
  return flattenFeatures(res.data);
}

export async function fetchReport(id, guestToken) {
  const params = guestToken ? { guest_token: guestToken } : undefined;
  const res = await api.get(`reports/${id}/`, { params });
  return flattenFeature(res.data);
}

/**
 * Build the multipart payload for report creation.
 * `item` carries: { description, category, lat, lng, accuracy, capturedAt,
 *                   integrityHash, imageUri }
 */
export function buildReportFormData(item) {
  const fd = new FormData();
  if (item.category) fd.append('category', String(item.category));
  fd.append('description', item.description || '');
  fd.append('location', `POINT(${item.lng} ${item.lat})`);
  fd.append('capture_source', 'CAMERA');
  fd.append('captured_at', item.capturedAt);
  if (item.accuracy != null) fd.append('gps_accuracy', String(Math.round(item.accuracy)));
  if (item.integrityHash) fd.append('client_integrity_hash', item.integrityHash);
  fd.append('image_before', {
    uri: item.imageUri,
    name: 'capture.jpg',
    type: 'image/jpeg',
  });
  return fd;
}

export async function createReport(item) {
  const res = await api.post('reports/', buildReportFormData(item), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return flattenFeature(res.data);
}
