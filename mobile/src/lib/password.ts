// Shared password policy: 6–8 characters, letters and/or numbers only (no symbols).
export const PASSWORD_POLICY_HINT = '6–8 characters, letters and/or numbers';

export function isValidPassword(value: string): boolean {
  const s = (value || '').trim();
  if (s.length < 6 || s.length > 8) return false;
  return /^[A-Za-z0-9]+$/.test(s);
}

export function passwordError(value: string): string | null {
  const s = (value || '').trim();
  if (s.length === 0) return 'Password is required.';
  if (s.length < 6 || s.length > 8) return 'Password must be 6–8 characters.';
  if (!/^[A-Za-z0-9]+$/.test(s)) return 'Use letters and/or numbers only (no symbols).';
  return null;
}
