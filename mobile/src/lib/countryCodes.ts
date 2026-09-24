export type CountryCode = { name: string; code: string; dial: string };

// Common dialing codes. The `dial` value is what gets prefixed to a local
// number for WhatsApp outreach (e.g. "+44" + "7700 900123").
export const COUNTRY_CODES: CountryCode[] = [
  { name: 'United States', code: 'US', dial: '+1' },
  { name: 'United Kingdom', code: 'GB', dial: '+44' },
  { name: 'India', code: 'IN', dial: '+91' },
  { name: 'Nigeria', code: 'NG', dial: '+234' },
  { name: 'Spain', code: 'ES', dial: '+34' },
  { name: 'United Arab Emirates', code: 'AE', dial: '+971' },
  { name: 'China', code: 'CN', dial: '+86' },
  { name: 'Australia', code: 'AU', dial: '+61' },
  { name: 'Canada', code: 'CA', dial: '+1' },
  { name: 'Germany', code: 'DE', dial: '+49' },
  { name: 'France', code: 'FR', dial: '+33' },
  { name: 'Singapore', code: 'SG', dial: '+65' },
  { name: 'Hong Kong', code: 'HK', dial: '+852' },
  { name: 'Malaysia', code: 'MY', dial: '+60' },
  { name: 'Philippines', code: 'PH', dial: '+63' },
  { name: 'Pakistan', code: 'PK', dial: '+92' },
  { name: 'Bangladesh', code: 'BD', dial: '+880' },
  { name: 'Kenya', code: 'KE', dial: '+254' },
  { name: 'South Africa', code: 'ZA', dial: '+27' },
  { name: 'Egypt', code: 'EG', dial: '+20' },
  { name: 'Saudi Arabia', code: 'SA', dial: '+966' },
  { name: 'Japan', code: 'JP', dial: '+81' },
  { name: 'South Korea', code: 'KR', dial: '+82' },
  { name: 'Brazil', code: 'BR', dial: '+55' },
  { name: 'Mexico', code: 'MX', dial: '+52' },
];
