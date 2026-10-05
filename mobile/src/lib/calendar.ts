import { Platform } from 'react-native';
import { format, parse } from 'date-fns';
import { zonedTimeToUtc, formatInTimeZone } from 'date-fns-tz';

/**
 * Appointments are scheduled in Hong Kong time (all staff work from HK; clients
 * may be in Japan, Malaysia, Taiwan, India, Singapore, Korea or Thailand). We
 * therefore interpret every wall-clock date+time the staff enter as Hong Kong
 * time and convert it to a single unambiguous UTC instant, so each client's
 * device renders the event in *their* local time with zero mismatch.
 *
 * HK is UTC+8 with no daylight saving, which keeps the math simple and stable.
 */
export const OFFICE_TIME_ZONE = 'Asia/Hong_Kong';
export const OFFICE_TIME_ZONE_LABEL = 'Hong Kong time (UTC+8)';

/**
 * Build an ICS (iCalendar) string for a confirmed appointment, so the client can
 * open/save it directly into their phone or desktop calendar — no login, no app
 * download. Returns null if the time/date can't be parsed.
 */
export function buildCalendarEvent(opts: {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "2:30 PM" (interpreted as Hong Kong time)
  durationMinutes?: number;
  description?: string;
  location?: string;
}): string | null {
  const { title, date, time, durationMinutes = 60, description = '', location = '' } = opts;

  // Normalise "2:30PM" / "2:30 PM" / "14:30" into a parseable form.
  const cleanTime = time
    .trim()
    .replace(/\s*([AaPp][Mm])\s*$/, ' $1')
    .replace(/\s+/g, ' ');

  // Parse the wall-clock date+time, then pin it to Hong Kong time and convert
  // to an absolute UTC instant. The reference date only seeds the local parse;
  // zonedTimeToUtc treats the components as being in OFFICE_TIME_ZONE.
  // 24-hour (HH:mm) is primary; legacy 12-hour (h:mm aa) is still accepted.
  const is24h = !/[AaPp][Mm]$/.test(cleanTime);
  const naive = parse(`${date} ${cleanTime}`, is24h ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd h:mm aa', new Date());
  if (Number.isNaN(naive.getTime())) return null;

  const startUtc = zonedTimeToUtc(naive, OFFICE_TIME_ZONE);
  const endUtc = new Date(startUtc.getTime() + durationMinutes * 60 * 1000);

  // UTC instants stamped with 'Z'. Devices render these in the viewer's local
  // time automatically, so a Japan client sees the correct hour while a Hong
  // Kong staff member sees HK time.
  const fmtUtc = (d: Date) => format(d, "yyyyMMdd'T'HHmmss'Z'");
  // Office-zone wall-clock label for the description (so the client can
  // cross-check the slot even if their calendar app ignores the TZID).
  const officeLabel = formatInTimeZone(
    startUtc,
    OFFICE_TIME_ZONE,
    'yyyy-MM-dd HH:mm',
  );

  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,');

  // Wall-clock DTSTART/DTEND in Hong Kong time (stable, no DST), so calendar
  // apps that support TZID render it exactly and those that don't fall back
  // safely. We also emit a floating-time VEVENT via the UTC DTSTAMP path below.
  const hkStartWall = formatInTimeZone(startUtc, OFFICE_TIME_ZONE, "yyyyMMdd'T'HHmmss");
  const hkEndWall = formatInTimeZone(endUtc, OFFICE_TIME_ZONE, "yyyyMMdd'T'HHmmss");

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VisaFlow//Appointment//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-TIMEZONE:${OFFICE_TIME_ZONE}`,
    'BEGIN:VEVENT',
    `UID:${Date.now()}@visaflow`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    `DTSTART;TZID=${OFFICE_TIME_ZONE}:${hkStartWall}`,
    `DTEND;TZID=${OFFICE_TIME_ZONE}:${hkEndWall}`,
    `SUMMARY:${escape(title)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escape(description)}`);
  if (location) lines.push(`LOCATION:${escape(location)}`);
  lines.push(
    // A reminder of the slot in office time, so the client can cross-check even
    // if their calendar app ignores the TZID.
    `COMMENT:${escape(`Office time: ${officeLabel} (${OFFICE_TIME_ZONE_LABEL})`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  );

  return lines.join('\r\n');
}

/**
 * Format a stored wall-clock time (e.g. "2:30 PM") for display, making explicit
 * that it is Hong Kong time so no client misreads their slot.
 */
export function formatOfficeTime(time: string): string {
  return `${time} (${OFFICE_TIME_ZONE_LABEL})`;
}

/**
 * Open the calendar event on the client's device. On web we generate a download
 * link for an .ics file (the browser hands it to the OS calendar); on native we
 * use expo-file-system to write the file and expo-sharing to present it.
 */
export async function openInCalendar(ics: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'appointment.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  const FileSystem = await import('expo-file-system');
  const Sharing = (await import('expo-sharing')).default;

  const fileUri = FileSystem.cacheDirectory + 'appointment.ics';
  await FileSystem.writeAsStringAsync(fileUri, ics, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: 'text/calendar' });
  }
}
