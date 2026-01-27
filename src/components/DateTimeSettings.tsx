import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Info } from 'lucide-react';
import { format } from 'date-fns';

interface DateTimeSettingsProps {
  dateFormat: string;
  timezone: string;
  country: string;
  onDateFormatChange: (format: string) => void;
  onTimezoneChange: (timezone: string) => void;
  disabled?: boolean;
}

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '27/01/2026' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '01/27/2026' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2026-01-27' },
  { value: 'D MMM YYYY', label: 'D MMM YYYY', example: '27 Jan 2026' },
  { value: 'MMM D, YYYY', label: 'MMM D, YYYY', example: 'Jan 27, 2026' },
];

// Common timezones grouped by region
const TIMEZONES = [
  // UK & Ireland
  { value: 'Europe/London', label: 'London (GMT/BST)', region: 'UK & Ireland' },
  { value: 'Europe/Dublin', label: 'Dublin (GMT/IST)', region: 'UK & Ireland' },
  // Europe
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)', region: 'Europe' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)', region: 'Europe' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)', region: 'Europe' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)', region: 'Europe' },
  { value: 'Europe/Rome', label: 'Rome (CET/CEST)', region: 'Europe' },
  { value: 'Europe/Vienna', label: 'Vienna (CET/CEST)', region: 'Europe' },
  { value: 'Europe/Zurich', label: 'Zurich (CET/CEST)', region: 'Europe' },
  { value: 'Europe/Warsaw', label: 'Warsaw (CET/CEST)', region: 'Europe' },
  { value: 'Europe/Stockholm', label: 'Stockholm (CET/CEST)', region: 'Europe' },
  // Americas
  { value: 'America/New_York', label: 'New York (EST/EDT)', region: 'Americas' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)', region: 'Americas' },
  { value: 'America/Denver', label: 'Denver (MST/MDT)', region: 'Americas' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)', region: 'Americas' },
  { value: 'America/Toronto', label: 'Toronto (EST/EDT)', region: 'Americas' },
  { value: 'America/Vancouver', label: 'Vancouver (PST/PDT)', region: 'Americas' },
  { value: 'America/Mexico_City', label: 'Mexico City (CST/CDT)', region: 'Americas' },
  // Asia-Pacific
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)', region: 'Asia-Pacific' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)', region: 'Asia-Pacific' },
  { value: 'Australia/Perth', label: 'Perth (AWST)', region: 'Asia-Pacific' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)', region: 'Asia-Pacific' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)', region: 'Asia-Pacific' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', region: 'Asia-Pacific' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', region: 'Asia-Pacific' },
];

// Map country codes to default timezones
const COUNTRY_TIMEZONES: Record<string, string> = {
  'GB': 'Europe/London',
  'IE': 'Europe/Dublin',
  'US': 'America/New_York',
  'CA': 'America/Toronto',
  'MX': 'America/Mexico_City',
  'DE': 'Europe/Berlin',
  'FR': 'Europe/Paris',
  'NL': 'Europe/Amsterdam',
  'ES': 'Europe/Madrid',
  'IT': 'Europe/Rome',
  'BE': 'Europe/Paris',
  'AT': 'Europe/Vienna',
  'CH': 'Europe/Zurich',
  'PL': 'Europe/Warsaw',
  'SE': 'Europe/Stockholm',
  'AU': 'Australia/Sydney',
  'NZ': 'Pacific/Auckland',
  'AE': 'Asia/Dubai',
  'SG': 'Asia/Singapore',
  'JP': 'Asia/Tokyo',
};

// Map country codes to default date formats
const COUNTRY_DATE_FORMATS: Record<string, string> = {
  'US': 'MM/DD/YYYY',
  'CA': 'YYYY-MM-DD',
  'JP': 'YYYY-MM-DD',
  // Most other countries use DD/MM/YYYY
};

export function DateTimeSettings({
  dateFormat,
  timezone,
  country,
  onDateFormatChange,
  onTimezoneChange,
  disabled = false,
}: DateTimeSettingsProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const isUK = country === 'GB';

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Get current time in selected timezone
  const getTimeInTimezone = (tz: string) => {
    try {
      return currentTime.toLocaleTimeString('en-GB', { 
        timeZone: tz, 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch {
      return '--:--';
    }
  };

  // Get formatted date example
  const getDateExample = (formatStr: string) => {
    const now = new Date();
    switch (formatStr) {
      case 'DD/MM/YYYY':
        return format(now, 'dd/MM/yyyy');
      case 'MM/DD/YYYY':
        return format(now, 'MM/dd/yyyy');
      case 'YYYY-MM-DD':
        return format(now, 'yyyy-MM-dd');
      case 'D MMM YYYY':
        return format(now, 'd MMM yyyy');
      case 'MMM D, YYYY':
        return format(now, 'MMM d, yyyy');
      default:
        return format(now, 'dd/MM/yyyy');
    }
  };

  // Group timezones by region
  const groupedTimezones = TIMEZONES.reduce((acc, tz) => {
    if (!acc[tz.region]) acc[tz.region] = [];
    acc[tz.region].push(tz);
    return acc;
  }, {} as Record<string, typeof TIMEZONES>);

  return (
    <div className="space-y-4">
      {/* Date Format - show for all users but highlight non-UK */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="date-format" className="text-sm font-medium">
            Date Format
          </Label>
        </div>
        <Select 
          value={dateFormat} 
          onValueChange={onDateFormatChange}
          disabled={disabled}
        >
          <SelectTrigger id="date-format" className="h-11 border-2 hover:border-primary/50 transition-colors">
            <SelectValue placeholder="Select date format..." />
          </SelectTrigger>
          <SelectContent>
            {DATE_FORMATS.map((fmt) => (
              <SelectItem key={fmt.value} value={fmt.value}>
                <div className="flex items-center justify-between gap-4 w-full">
                  <span>{fmt.label}</span>
                  <span className="text-muted-foreground text-xs">({fmt.example})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Today: <span className="font-medium text-foreground">{getDateExample(dateFormat)}</span>
        </p>
      </div>

      {/* Timezone - show prominently for non-UK users */}
      {!isUK && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="timezone" className="text-sm font-medium">
              Timezone
            </Label>
          </div>
          <Select 
            value={timezone} 
            onValueChange={onTimezoneChange}
            disabled={disabled}
          >
            <SelectTrigger id="timezone" className="h-11 border-2 hover:border-primary/50 transition-colors">
              <SelectValue placeholder="Select timezone..." />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {Object.entries(groupedTimezones).map(([region, timezones]) => (
                <div key={region}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                    {region}
                  </div>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Current time: <span className="font-medium text-foreground">{getTimeInTimezone(timezone)}</span>
          </p>
        </div>
      )}

      {/* Info note for UK users */}
      {isUK && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-info/10 border border-info/20">
          <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Timezone is set to <span className="font-medium">London (GMT/BST)</span> for UK users. 
            Change your country in the region settings above to access timezone options.
          </p>
        </div>
      )}
    </div>
  );
}

export { COUNTRY_TIMEZONES, COUNTRY_DATE_FORMATS };
