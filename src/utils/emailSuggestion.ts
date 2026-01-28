// Common email domain typos and their corrections
const DOMAIN_CORRECTIONS: Record<string, string> = {
  // Gmail
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gimail.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'g]mail.com': 'gmail.com',
  // Yahoo
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'yhaoo.com': 'yahoo.com',
  // Hotmail/Outlook
  'hotmal.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlook.con': 'outlook.com',
  'outllook.com': 'outlook.com',
  // iCloud
  'iclod.com': 'icloud.com',
  'icould.com': 'icloud.com',
  'icloud.co': 'icloud.com',
  'icloud.con': 'icloud.com',
  // Common UK domains
  'co.uj': 'co.uk',
  'co.ul': 'co.uk',
  'couk': 'co.uk',
  // Common TLD typos
  '.con': '.com',
  '.cmo': '.com',
  '.ocm': '.com',
  '.cm': '.com',
};

// Valid common domains for suggestions
const COMMON_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'live.com',
  'msn.com',
  'btinternet.com',
  'sky.com',
  'virginmedia.com',
  'talktalk.net',
];

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find the closest matching domain from common domains
 */
function findClosestDomain(domain: string): string | null {
  let closest: string | null = null;
  let minDistance = Infinity;
  const threshold = 2; // Maximum edit distance to consider

  for (const commonDomain of COMMON_DOMAINS) {
    const distance = levenshteinDistance(domain.toLowerCase(), commonDomain);
    if (distance < minDistance && distance <= threshold && distance > 0) {
      minDistance = distance;
      closest = commonDomain;
    }
  }

  return closest;
}

export interface EmailSuggestion {
  original: string;
  suggested: string;
  domain: string;
}

/**
 * Check an email address for common typos and suggest corrections
 */
export function getEmailSuggestion(email: string): EmailSuggestion | null {
  if (!email || !email.includes('@')) {
    return null;
  }

  const [localPart, domain] = email.split('@');
  
  if (!domain || !localPart) {
    return null;
  }

  const lowerDomain = domain.toLowerCase();

  // Check for exact domain corrections first
  if (DOMAIN_CORRECTIONS[lowerDomain]) {
    const correctedDomain = DOMAIN_CORRECTIONS[lowerDomain];
    return {
      original: email,
      suggested: `${localPart}@${correctedDomain}`,
      domain: correctedDomain,
    };
  }

  // Check for TLD typos
  for (const [typo, correction] of Object.entries(DOMAIN_CORRECTIONS)) {
    if (lowerDomain.endsWith(typo)) {
      const correctedDomain = lowerDomain.replace(typo, correction);
      // Verify the corrected domain is valid
      const closestMatch = findClosestDomain(correctedDomain);
      if (closestMatch || COMMON_DOMAINS.includes(correctedDomain)) {
        return {
          original: email,
          suggested: `${localPart}@${closestMatch || correctedDomain}`,
          domain: closestMatch || correctedDomain,
        };
      }
    }
  }

  // Find closest matching domain using Levenshtein distance
  const closest = findClosestDomain(lowerDomain);
  if (closest && closest !== lowerDomain) {
    return {
      original: email,
      suggested: `${localPart}@${closest}`,
      domain: closest,
    };
  }

  return null;
}

/**
 * Validate password strength requirements
 * Returns { valid: boolean, errors: string[] }
 */
export interface PasswordValidation {
  valid: boolean;
  errors: string[];
  requirements: {
    minLength: boolean;
    hasLetter: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
}

export function validatePasswordStrength(password: string): PasswordValidation {
  const errors: string[] = [];
  const requirements = {
    minLength: password.length >= 8,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^a-zA-Z0-9]/.test(password),
  };

  if (!requirements.minLength) {
    errors.push('At least 8 characters');
  }
  if (!requirements.hasLetter) {
    errors.push('At least one letter');
  }
  if (!requirements.hasNumber) {
    errors.push('At least one number');
  }
  if (!requirements.hasSpecial) {
    errors.push('At least one special character (!@#$%^&*)');
  }

  return {
    valid: errors.length === 0,
    errors,
    requirements,
  };
}
