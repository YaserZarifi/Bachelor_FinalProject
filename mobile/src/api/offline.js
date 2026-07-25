import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
// SDK 54: classic file API (documentDirectory, copyAsync, …) is under /legacy.
import * as FileSystem from 'expo-file-system/legacy';
import { createReport } from './reports';
import { pingServer } from './client';
import { rememberGuestReport } from './guestStore';

const QUEUE_KEY = 'pending_reports';
const MAX_ATTEMPTS = 6;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Live subscriptions ───────────────────────────────────────────────────────
// The UI subscribes to queue mutations and to sync-in-progress state so the
// "pending reports" card can reflect connectivity/progress without polling.
const queueListeners = new Set();
const syncListeners = new Set();
let syncing = false;

/** Subscribe to queue changes. Fires immediately with the current queue. */
export function subscribeQueue(fn) {
  queueListeners.add(fn);
  readQueue().then(fn).catch(() => {});
  return () => queueListeners.delete(fn);
}

/** Subscribe to sync-in-progress state. Fires immediately with the current value. */
export function subscribeSyncing(fn) {
  syncListeners.add(fn);
  fn(syncing);
  return () => syncListeners.delete(fn);
}

function emitSyncing(value) {
  syncing = value;
  for (const fn of syncListeners) fn(value);
}

// ── Server reachability (real ping, not just internet) ───────────────────────
// A single shared poller drives the connection indicator for every mounted
// PendingQueue. Status is one of:
//   'checking' | 'online' | 'server-down' | 'no-network'
const SERVER_POLL_MS = 8000;
const serverListeners = new Set();
let serverStatus = 'checking';
let serverPollTimer = null;
let serverNetUnsub = null;
let serverChecking = false;

/** Subscribe to server-reachability status. Fires immediately; starts the shared
 *  poller while at least one subscriber is active and stops it when none remain. */
export function subscribeServer(fn) {
  serverListeners.add(fn);
  fn(serverStatus);
  startServerPolling();
  return () => {
    serverListeners.delete(fn);
    if (serverListeners.size === 0) stopServerPolling();
  };
}

function setServerStatus(next) {
  const cameOnline = next === 'online' && serverStatus !== 'online';
  if (next !== serverStatus) {
    serverStatus = next;
    for (const fn of serverListeners) fn(next);
  }
  // The link to the API server just came back — flush whatever is queued.
  if (cameOnline) syncQueue();
}

/** Probe the API server now: no network → 'no-network'; reachable → 'online';
 *  network but no server → 'server-down'. */
export async function checkServer() {
  if (serverChecking) return serverStatus;
  serverChecking = true;
  try {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      setServerStatus('no-network');
      return serverStatus;
    }
    const ok = await pingServer();
    setServerStatus(ok ? 'online' : 'server-down');
    return serverStatus;
  } catch {
    setServerStatus('server-down');
    return serverStatus;
  } finally {
    serverChecking = false;
  }
}

function startServerPolling() {
  if (!serverNetUnsub) {
    // Re-probe immediately whenever the OS reports a connectivity change.
    serverNetUnsub = NetInfo.addEventListener(() => checkServer());
  }
  if (!serverPollTimer) {
    serverPollTimer = setInterval(() => checkServer(), SERVER_POLL_MS);
  }
  checkServer();
}

function stopServerPolling() {
  if (serverPollTimer) {
    clearInterval(serverPollTimer);
    serverPollTimer = null;
  }
  if (serverNetUnsub) {
    serverNetUnsub();
    serverNetUnsub = null;
  }
  serverStatus = 'checking';
}

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
  // Every mutation flows through writeQueue, so this is the single notify point.
  for (const fn of queueListeners) fn(items);
}

export async function getPendingCount() {
  return (await readQueue()).length;
}

/** The full queue, for rendering the pending list in the UI. */
export async function getPendingReports() {
  return readQueue();
}

/** Remove one queued report (and its stored image) by localId. */
export async function removePending(localId) {
  const queue = await readQueue();
  const item = queue.find((q) => q.localId === localId);
  if (!item) return false;
  await deleteStoredImage(item.imageUri);
  await writeQueue(queue.filter((q) => q.localId !== localId));
  return true;
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
  // Both the connectivity listener and screen-focus can trigger a flush; skip if
  // one is already running so items aren't sent twice.
  if (syncing) return { synced: 0, failed: 0, dropped: 0, skipped: true };
  const queue = await readQueue();
  if (!queue.length) return { synced: 0, failed: 0, dropped: 0 };

  emitSyncing(true);
  try {
    return await flushQueue(queue);
  } finally {
    emitSyncing(false);
  }
}

async function flushQueue(queue) {
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
