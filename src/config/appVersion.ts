/**
 * App Version Configuration
 * 
 * Update version here when releasing new versions.
 * Format: vX.Y (e.g., v0.9, v1.0, v1.1)
 * 
 * This is the SINGLE source of truth for the app version.
 */

export const APP_VERSION = "v0.9";

export const APP_NAME = "Showmen's Ride Ready";

/**
 * Internal Change Log
 * 
 * Records all version changes for testing and bug reporting.
 * Add new entries at the TOP of the array.
 */
export interface ChangeLogEntry {
  version: string;
  date: string; // ISO format: YYYY-MM-DD
  description: string;
}

export const CHANGE_LOG: ChangeLogEntry[] = [
  {
    version: "v0.9",
    date: "2026-01-18",
    description: "Initial beta release with document management, ride tracking, safety certificates, and versioning system."
  },
];

/**
 * Get the latest update date from the change log
 */
export const getLastUpdateDate = (): string => {
  if (CHANGE_LOG.length === 0) return "Unknown";
  return CHANGE_LOG[0].date;
};

/**
 * Format date for display
 */
export const formatVersionDate = (isoDate: string): string => {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  } catch {
    return isoDate;
  }
};
