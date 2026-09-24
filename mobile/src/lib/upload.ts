import { Platform } from 'react-native';
import { supabase } from '@/src/db/client';

/** File suffix per document kind: PP = Passport, AP = Address Proof, SC = Zoom Screen Capture. */
const SUFFIX: Record<DocKind, string> = {
  passport: 'PP',
  address: 'AP',
  capture: 'SC',
};

export type DocKind = 'passport' | 'address' | 'capture';

/**
 * Upload a picked image (device URI or web blob/data URI) to the Supabase Storage
 * bucket `client-docs` and return the resulting PUBLIC url.
 *
 * Picking a photo only yields a local/transient URI (file:// on device, blob: on web).
 * Saving that URI into the DB would make the file disappear as soon as the device/browser
 * changes. We instead read the bytes once, upload to Storage, and persist the permanent URL.
 *
 * Files are named by the CLIENT SERIAL NUMBER with a document suffix so documents are
 * human-readable and self-labeling in the bucket:
 *   {reg_no}_{PP|AP|SC}.{ext}   e.g. REG-2026-0001_PP.jpg
 * A re-upload of the same kind overwrites the previous object (upsert: true), so each
 * client keeps exactly one clean file per document type.
 */
export async function uploadClientDoc(
  uri: string,
  kind: DocKind,
  regNo: string,
): Promise<string> {
  // Blob for upload. On web, fetch() handles blob:/data: fine. On native we go through expo-file-system.
  const blob = await uriToBlob(uri);

  const ext = guessExtension(uri, blob.type);
  const safeReg = regNo.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${kind}/${safeReg}_${SUFFIX[kind]}.${ext}`;

  const { error } = await supabase.storage.from('client-docs').upload(path, blob, {
    contentType: blob.type || undefined,
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('client-docs').getPublicUrl(path);
  return data.publicUrl;
}

async function uriToBlob(uri: string): Promise<Blob> {
  // Web / data URIs: fetch works everywhere a browser exists.
  if (Platform.OS === 'web' || uri.startsWith('data:')) {
    const res = await fetch(uri);
    return await res.blob();
  }

  // Native: expo-file-system can read a file:// source to base64, then build a Blob.
  const FileSystem = await import('expo-file-system');
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const mime = mimeFromUri(uri);
  // Reconstruct a Blob from base64 without a Buffer on Hermes.
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function guessExtension(uri: string, mime: string): string {
  const fromUri = uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (fromUri && fromUri.length <= 5 && /^[a-z0-9]+$/.test(fromUri)) return fromUri;
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'jpg';
}

function mimeFromUri(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}
