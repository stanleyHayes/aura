/**
 * Add an approved booking to the device calendar (Section 13 — expo-calendar).
 * Requests permission, finds a writable calendar, and creates the event.
 */
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export interface CalendarEventInput {
  title: string;
  notes?: string;
  startsAt: string; // RFC 3339
  endsAt: string; // RFC 3339
  location?: string;
}

async function getWritableCalendarId(): Promise<string | null> {
  if (Platform.OS === 'ios') {
    const defaultCal = await Calendar.getDefaultCalendarAsync();
    if (defaultCal?.id) return defaultCal.id;
  }
  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
  const writable = calendars.find(
    (c) => c.allowsModifications && c.accessLevel !== Calendar.CalendarAccessLevel.READ,
  );
  return writable?.id ?? calendars[0]?.id ?? null;
}

/**
 * @returns the created event id, or null if permission was denied / no calendar.
 */
export async function addBookingToCalendar(
  input: CalendarEventInput,
): Promise<string | null> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') return null;

  const calendarId = await getWritableCalendarId();
  if (!calendarId) return null;

  return Calendar.createEventAsync(calendarId, {
    title: input.title,
    notes: input.notes,
    startDate: new Date(input.startsAt),
    endDate: new Date(input.endsAt),
    location: input.location,
    timeZone: undefined, // device timezone
  });
}
