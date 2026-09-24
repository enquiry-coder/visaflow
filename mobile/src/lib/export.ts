import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

type ExportRow = Record<string, string>;

/**
 * Escape a value for a CSV cell: wrap in quotes and double any inner quotes.
 * Also prefix cells beginning with =,+,-,@ to guard against CSV formula injection.
 */
function csvCell(value: string): string {
  if (/^[=+\-@]/.test(value)) {
    value = "'" + value;
  }
  return '"' + value.replace(/"/g, '""') + '"';
}

function buildCsv(headers: string[], rows: ExportRow[]): string {
  const lines: string[] = [];
  lines.push(headers.map(csvCell).join(','));
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h] ?? '')).join(','));
  }
  // Prefix UTF-8 BOM so Excel opens non-ASCII names correctly.
  return '\uFEFF' + lines.join('\r\n');
}

/** Extract a file extension from a URL, defaulting to a sensible value. */
export function fileExt(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const clean = url.split('?')[0];
    const m = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

/**
 * Build a stable, human-friendly document reference keyed to the client's serial
 * number (reg_no). E.g. `REG-2026-0001_passport.pdf`.
 */
export function docRef(regNo: string, kind: 'passport' | 'address' | 'capture', url: string | null | undefined): string {
  if (!url) return '';
  const ext = fileExt(url);
  const suffix = kind === 'passport' ? 'PP' : kind === 'address' ? 'AP' : 'SC';
  return `${regNo}_${suffix}${ext ? '.' + ext : ''}`;
}

/**
 * Generate the CSV and hand it to the OS: on web we trigger a download via a
 * blob + anchor; on native we write a temp file and open the share sheet.
 */
export async function downloadCsv(filename: string, headers: string[], rows: ExportRow[]): Promise<void> {
  const csv = buildCsv(headers, rows);

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  // Native: write to cache and open the share sheet.
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  const path = `${dir}${filename}`;
  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: filename });
    return;
  }
  throw new Error('Download is not supported on this platform.');
}
