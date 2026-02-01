/**
 * App Version Configuration
 * 
 * Update version here when releasing new versions.
 * Format: vX.Y (e.g., v0.9, v1.0, v1.1)
 * 
 * This is the SINGLE source of truth for the app version.
 */

export const APP_VERSION = "v0.12";

export const APP_NAME = "Ride Ready Docs";

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
    version: "v0.12",
    date: "2026-02-01",
    description: "Granular staff permissions: owners can now select exactly which features each staff member can access via checkboxes (Calendar, Documents, Checks, Maintenance, Risk Assessments, Send Documents). Improved PWA update detection with visible 'Checking for updates' indicator for installed app users. UI terminology updated to 'Equipment' for broader asset type support."
  },
  {
    version: "v0.11",
    date: "2026-01-28",
    description: "Major update: Staff management with role-based permissions, organisation structure, equipment assignments. Enhanced risk assessments with audit logging, revision history, and improved PDF export. AI-powered help assistant in Help Center. Global rebrand to Ride Ready Docs. Improved check item library with AI categorisation."
  },
  {
    version: "v0.10",
    date: "2026-01-23",
    description: "Bug fixes: Added 'Add Ride' button in document upload when no equipment exists, fixed Checks icon for testers, improved image loading performance, updated placeholder names. Improved bug report form with tester-friendly language and new issue types (Idea/Suggestion, Question, Confusing, etc.)."
  },
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
