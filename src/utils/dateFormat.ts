import { format, parseISO } from 'date-fns';

/**
 * UK date format utilities
 * All dates should display in UK format: DD/MM/YYYY or DD MMM YYYY
 */

// Short numeric format: 27/01/2026
export const formatDateUK = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB');
};

// Medium format: 27 Jan 2026
export const formatDateMedium = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Long format: 27 January 2026
export const formatDateLong = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

// With weekday: Monday, 27 January 2026
export const formatDateFull = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

// For date-fns format() replacement - use 'dd/MM/yyyy' instead of 'PPP'
export const UK_DATE_FORMAT = 'dd/MM/yyyy';
export const UK_DATE_FORMAT_MEDIUM = 'd MMM yyyy';
export const UK_DATE_FORMAT_LONG = 'd MMMM yyyy';

// Helper for ISO strings with date-fns
export const formatISODateUK = (isoDate: string): string => {
  return format(parseISO(isoDate), UK_DATE_FORMAT_MEDIUM);
};
