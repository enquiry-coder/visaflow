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
