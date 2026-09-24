import * as Crypto from 'expo-crypto';

/**
 * Generate a UUID v4 using real OS entropy (expo-crypto on device, Web Crypto on web).
 * Never use Math.random — it silently weakens Supabase auth PKCE and produces collidable ids.
 */
export const newId = () => Crypto.randomUUID();
