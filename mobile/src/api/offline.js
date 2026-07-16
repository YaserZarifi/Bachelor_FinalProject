import AsyncStorage from '@react-native-async-storage/async-storage';
// SDK 54: classic file API (documentDirectory, copyAsync, …) is under /legacy.
import * as FileSystem from 'expo-file-system/legacy';
import { createReport } from './reports';
import { rememberGuestReport } from './guestStore';

const QUEUE_KEY = 'pending_reports';
const MAX_ATTEMPTS = 6;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function readQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
async function writeQueue(items) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function getPendingCount() {
  return (await readQueue()).length;
}

function makeLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function deleteStoredImage(uri) {
  if (uri?.startsWith(FileSystem.documentDirectory)) {
    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}

/** Persist the captured image into a durable location and enqueue the report. */
export async function enqueueReport(item) {
  let imageUri = item.imageUri;
  try {
    const dir = `${FileSystem.documentDirectory}pending/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const dest = `${dir}${makeLocalId()}.jpg`;
    await FileSystem.copyAsync({ from: item.imageUri, to: dest });
    imageUri = dest;
  } catch {
    // fall back to original uri
  }
  const queue = await readQueue();
  const entry = { ...item, imageUri, localId: makeLocalId(), queuedAt: Date.now(), attempts: 0 };
  queue.push(entry);
  await writeQueue(queue);
  return entry;
}

/**
 * Try to flush the queue. Returns { synced, failed, dropped }.
 * An item is dropped (not retried forever) once it exceeds MAX_ATTEMPTS, ages
 * out, or its stored image has been purged by the OS.
 */
export async function syncQueue() {
  const queue = await readQueue();
  if (!queue.length) return { synced: 0, failed: 0, dropped: 0 };

  const remaining = [];
  let synced = 0;
  let dropped = 0;

  for (const item of queue) {
    // Expiry / dead-letter checks before spending a network call.
    const tooOld = item.queuedAt && Date.now() - item.queuedAt > MAX_AGE_MS;
    if (tooOld || (item.attempts || 0) >= MAX_ATTEMPTS) {
      await deleteStoredImage(item.imageUri);
      dropped += 1;
      continue;
    }
    // If the stored image vanished, the item can never sync — drop it.
    if (item.imageUri?.startsWith(FileSystem.documentDirectory)) {
      const info = await FileSystem.getInfoAsync(item.imageUri).catch(() => null);
      if (!info?.exists) {
        dropped += 1;
        continue;
      }
    }

    try {
      const report = await createReport(item);
      synced += 1;
      if (report?.guest_access_token) {
        await rememberGuestReport({
          id: report.id,
          token: report.guest_access_token,
          description: item.description,
          status: report.status || 'SUBMITTED',
        });
      }
      await deleteStoredImage(item.imageUri);
    } catch {
      remaining.push({ ...item, attempts: (item.attempts || 0) + 1 });
    }
  }

  await writeQueue(remaining);
  return { synced, failed: remaining.length, dropped };
}
