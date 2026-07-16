import * as Crypto from 'expo-crypto';
// SDK 54: the classic file API lives under /legacy (the new File/Directory API
// is the default export). We only need readAsStringAsync here.
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Compute the trusted-capture integrity hash.
 *
 * The web app hashes (imageBytes || metaBytes). On native we don't have the raw
 * decoded bytes cheaply, so we hash (base64(image) || metaString) with SHA-256.
 * The backend only *stores* this value (write-once) — it never recomputes it —
 * so a self-consistent native scheme is sufficient and still tamper-evident.
 */
export async function computeCaptureHash(imageUri, meta) {
  const { lat, lng, capturedAt, accuracy } = meta;
  const metaString = `${Number(lat).toFixed(6)}|${Number(lng).toFixed(6)}|${capturedAt}|${Math.round(
    accuracy || 0
  )}`;

  let base64 = '';
  try {
    base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    base64 = '';
  }

  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${base64}|${metaString}`
  );
}
