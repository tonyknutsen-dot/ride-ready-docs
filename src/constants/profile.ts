// Shared profile-related constants for consistency across the app

export const COUNTRIES = [
  // UK & Ireland
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', note: 'Annual inspection certificates' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', note: 'Annual inspection certificates' },
  // Americas
  { code: 'US', name: 'United States', flag: '🇺🇸', note: 'Uses ASTM F24 compliant safety certifications' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', note: 'Uses provincial safety certifications' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', note: 'Uses safety compliance certificates' },
  // Europe
  { code: 'DE', name: 'Germany', flag: '🇩🇪', note: 'Uses TÜV safety certifications' },
  { code: 'FR', name: 'France', flag: '🇫🇷', note: 'Uses safety compliance certificates' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', note: 'Uses safety compliance certificates' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', note: 'Uses safety compliance certificates' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', note: 'Uses safety compliance certificates' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', note: 'Uses safety compliance certificates' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹', note: 'Uses safety compliance certificates' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', note: 'Uses safety compliance certificates' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', note: 'Uses safety compliance certificates' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', note: 'Uses safety compliance certificates' },
  // Asia-Pacific
  { code: 'AU', name: 'Australia', flag: '🇦🇺', note: 'Uses Declaration of Compliance certificates' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', note: 'Uses Declaration of Compliance certificates' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', note: 'Uses safety compliance certificates' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', note: 'Uses safety compliance certificates' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', note: 'Uses safety compliance certificates' },
  // Other
  { code: 'OTHER', name: 'Other Country', flag: '🌍', note: 'Uses Declaration of Compliance certificates' },
] as const;

export const OPERATOR_TYPES = [
  { value: 'showman', label: 'Showman', description: 'Traditional travelling showman or fairground family' },
  { value: 'private_operator', label: 'Private Operator', description: 'Independent ride or attraction operator' },
  { value: 'company', label: 'Company', description: 'Business or corporate operator' },
] as const;

export type CountryCode = typeof COUNTRIES[number]['code'];
export type OperatorTypeValue = typeof OPERATOR_TYPES[number]['value'];

// Terminology maps for country-based terminology preview
export const getTerminologyForCountry = (countryCode: string) => {
  const UK_TERMS = {
    safetyCertificate: "Annual Inspection Certificate",
    localAuthority: "council",
    inspector: "safety inspector",
  };

  const GLOBAL_TERMS = {
    safetyCertificate: "Safety Compliance Certificate",
    localAuthority: "local authority",
    inspector: "safety inspector",
  };

  const GERMANY_TERMS = {
    safetyCertificate: "TÜV Safety Certificate",
    localAuthority: "authority",
    inspector: "TÜV inspector",
  };

  const US_TERMS = {
    safetyCertificate: "Annual Safety Inspection Certificate",
    localAuthority: "state/local authority",
    inspector: "certified inspector",
  };

  const AUSTRALIA_TERMS = {
    ...GLOBAL_TERMS,
    localAuthority: "council",
  };

  const CANADA_TERMS = {
    ...GLOBAL_TERMS,
    localAuthority: "provincial authority",
  };

  switch (countryCode) {
    case "GB": return UK_TERMS;
    case "DE": return GERMANY_TERMS;
    case "US": return US_TERMS;
    case "AU":
    case "NZ": return AUSTRALIA_TERMS;
    case "CA": return CANADA_TERMS;
    default: return GLOBAL_TERMS;
  }
};
