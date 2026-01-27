import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Filter, X, Search } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subDays, startOfYear, endOfYear } from 'date-fns';
import { cn } from '@/lib/utils';

export interface CheckRecordFiltersState {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  checkType: string;
  searchQuery: string;
}

interface CheckRecordFiltersProps {
  filters: CheckRecordFiltersState;
  onFiltersChange: (filters: CheckRecordFiltersState) => void;
  onClear: () => void;
  documentCount: number;
  filteredCount: number;
}

const datePresets = [
  { label: 'This Month', getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: 'Last 30 Days', getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: 'Last 90 Days', getValue: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
  { label: 'This Year', getValue: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }) },
];

const checkTypes = [
  { value: 'all', label: 'All Check Types' },
  { value: 'pre-opening', label: 'Pre-Opening' },
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export const CheckRecordFilters = ({
  filters,
  onFiltersChange,
  onClear,
  documentCount,
  filteredCount,
}: CheckRecordFiltersProps) => {
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.checkType !== 'all' || filters.searchQuery;

  const handlePresetClick = (preset: typeof datePresets[0]) => {
    const { from, to } = preset.getValue();
    onFiltersChange({ ...filters, dateFrom: from, dateTo: to });
  };

  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border/60">
      {/* Quick date presets */}
      <div className="flex flex-wrap gap-1.5">
        {datePresets.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => handlePresetClick(preset)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Custom date range */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Popover open={fromOpen} onOpenChange={setFromOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-full justify-start text-left font-normal h-8 text-xs",
                  !filters.dateFrom && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {filters.dateFrom ? format(filters.dateFrom, "dd MMM yyyy") : "Start date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateFrom}
                onSelect={(date) => {
                  onFiltersChange({ ...filters, dateFrom: date });
                  setFromOpen(false);
                }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Popover open={toOpen} onOpenChange={setToOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-full justify-start text-left font-normal h-8 text-xs",
                  !filters.dateTo && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {filters.dateTo ? format(filters.dateTo, "dd MMM yyyy") : "End date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateTo}
                onSelect={(date) => {
                  onFiltersChange({ ...filters, dateTo: date });
                  setToOpen(false);
                }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Check type filter */}
      <div className="flex gap-2">
        <Select
          value={filters.checkType}
          onValueChange={(value) => onFiltersChange({ ...filters, checkType: value })}
        >
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder="Check type" />
          </SelectTrigger>
          <SelectContent>
            {checkTypes.map((type) => (
              <SelectItem key={type.value} value={type.value} className="text-xs">
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={filters.searchQuery}
            onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
            className="h-8 text-xs pl-7"
          />
        </div>
      </div>

      {/* Results summary & clear */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between pt-1">
          <Badge variant="secondary" className="text-xs">
            <Filter className="h-3 w-3 mr-1" />
            Showing {filteredCount} of {documentCount}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground hover:text-foreground"
            onClick={onClear}
          >
            <X className="h-3 w-3 mr-1" />
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
};

export const defaultCheckRecordFilters: CheckRecordFiltersState = {
  dateFrom: undefined,
  dateTo: undefined,
  checkType: 'all',
  searchQuery: '',
};

export const isCheckRecord = (documentType: string, filePath?: string): boolean => {
  const t = documentType.trim().toLowerCase();
  return t === 'check record' || 
         t === 'check_record' || 
         t.includes('safety check') ||
         (filePath?.includes('/check-records/') ?? false);
};

export const filterCheckRecords = <T extends { document_name: string; document_type: string; uploaded_at?: string; notes?: string | null; file_path?: string }>(
  documents: T[],
  filters: CheckRecordFiltersState
): T[] => {
  return documents.filter(doc => {
    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      if (!doc.uploaded_at) return true; // Skip date filtering if no date
      const docDate = new Date(doc.uploaded_at);
      if (filters.dateFrom && docDate < filters.dateFrom) return false;
      if (filters.dateTo) {
        const endOfDay = new Date(filters.dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (docDate > endOfDay) return false;
      }
    }

    // Check type filter - parse from document name
    if (filters.checkType !== 'all') {
      const name = doc.document_name.toLowerCase();
      const matchesType = 
        (filters.checkType === 'pre-opening' && name.includes('pre-opening')) ||
        (filters.checkType === 'daily' && name.includes('daily')) ||
        (filters.checkType === 'monthly' && name.includes('monthly')) ||
        (filters.checkType === 'yearly' && name.includes('yearly'));
      if (!matchesType) return false;
    }

    // Search query filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesSearch = 
        doc.document_name.toLowerCase().includes(query) ||
        (doc.notes?.toLowerCase().includes(query) ?? false);
      if (!matchesSearch) return false;
    }

    return true;
  });
};
