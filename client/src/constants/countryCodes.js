// A deliberately short, curated list rather than a full ~200-country dataset
// or a new dependency — good enough for a dial-code picker; Firebase itself
// is the authoritative validator of the final phone number (returns
// auth/invalid-phone-number for anything it rejects). India is first and is
// this app's default market.
export const COUNTRY_CODES = [
  { iso: 'IN', name: 'India', dialCode: '+91' },
  { iso: 'US', name: 'United States', dialCode: '+1' },
  { iso: 'CA', name: 'Canada', dialCode: '+1' },
  { iso: 'GB', name: 'United Kingdom', dialCode: '+44' },
  { iso: 'AE', name: 'United Arab Emirates', dialCode: '+971' },
  { iso: 'SG', name: 'Singapore', dialCode: '+65' },
  { iso: 'AU', name: 'Australia', dialCode: '+61' },
  { iso: 'DE', name: 'Germany', dialCode: '+49' },
  { iso: 'FR', name: 'France', dialCode: '+33' },
  { iso: 'NL', name: 'Netherlands', dialCode: '+31' },
  { iso: 'JP', name: 'Japan', dialCode: '+81' },
  { iso: 'CN', name: 'China', dialCode: '+86' },
  { iso: 'BR', name: 'Brazil', dialCode: '+55' },
  { iso: 'ZA', name: 'South Africa', dialCode: '+27' },
  { iso: 'NG', name: 'Nigeria', dialCode: '+234' },
  { iso: 'PK', name: 'Pakistan', dialCode: '+92' },
  { iso: 'BD', name: 'Bangladesh', dialCode: '+880' },
  { iso: 'NP', name: 'Nepal', dialCode: '+977' },
  { iso: 'LK', name: 'Sri Lanka', dialCode: '+94' },
  { iso: 'SA', name: 'Saudi Arabia', dialCode: '+966' },
];

export const DEFAULT_COUNTRY = COUNTRY_CODES[0]; // India
