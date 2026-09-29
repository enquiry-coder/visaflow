import AsyncStorage from '@react-native-async-storage/async-storage';

// Remember ONLY the last signed-in email so the sign-in form can pre-fill it
// after a staff signs out. The password is intentionally never persisted.
const EMAIL_KEY = 'visaflow:last_email';

export async function saveRememberedEmail(email: string): Promise<void> {
  try {
    const value = (email || '').trim();
    if (value) await AsyncStorage.setItem(EMAIL_KEY, value);
  } catch {
    // best-effort; never block sign-in on storage failure
  }
}

export async function getRememberedEmail(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(EMAIL_KEY)) || '';
  } catch {
    return '';
  }
}

// Remember each staff user's Zoom link so entering it once auto-fills it for
// every subsequent client they handle. Keyed per user id (not globally), so
// different staff keep their own distinct Zoom links.
const zoomKey = (userId: string) => `visaflow:zoom_link:${userId}`;

export async function saveStaffZoomLink(userId: string, link: string): Promise<void> {
  try {
    const value = (link || '').trim();
    const key = zoomKey(userId);
    if (value && userId) await AsyncStorage.setItem(key, value);
    else if (userId) await AsyncStorage.removeItem(key);
  } catch {
    // best-effort; never block sending on storage failure
  }
}

export async function getStaffZoomLink(userId: string): Promise<string> {
  try {
    if (!userId) return '';
    return (await AsyncStorage.getItem(zoomKey(userId))) || '';
  } catch {
    return '';
  }
}
