import { Platform } from 'react-native';
import { format, parse } from 'date-fns';

/**
 * Build an ICS (iCalendar) string for a confirmed appointment, so the client can
 * open/save it directly into their phone or desktop calendar — no login, no app
 * download. Returns null if the time/date can't be parsed.
 */
export function buildCalendarEvent(opts: {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "2:30 PM"
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

  const start = parse(
    `${date} ${cleanTime}`,
    'yyyy-MM-dd h:mm aa',
    new Date(),
  );
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const fmt = (d: Date) => format(d, "yyyyMMdd'T'HHmmss");
  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VisaFlow//Appointment//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@visaflow`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escape(title)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escape(description)}`);
  if (location) lines.push(`LOCATION:${escape(location)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n');
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
