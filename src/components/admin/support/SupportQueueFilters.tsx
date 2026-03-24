import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import type { SortOption } from './types';

interface Props {
  filterStatus: string;
  onFilterChange: (v: string) => void;
  sortBy: SortOption;
  onSortChange: (v: SortOption) => void;
  search: string;
  onSearchChange: (v: string) => void;
  counts: Record<string, number>;
}

export function SupportQueueFilters({
  filterStatus, onFilterChange,
  sortBy, onSortChange,
  search, onSearchChange,
  counts,
}: Props) {
  const queueOptions = [
    { value: 'open', label: 'Open', count: counts.open },
    { value: 'pending', label: 'New', count: counts.pending },
    { value: 'in_progress', label: 'In Progress', count: counts.in_progress },
    { value: 'waiting_on_user', label: 'Waiting on User', count: counts.waiting_on_user },
    { value: 'resolved', label: 'Resolved', count: counts.resolved },
    { value: 'archived', label: 'Archived', count: counts.archived },
    { value: 'all', label: 'All', count: counts.all },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, subject…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={filterStatus} onValueChange={onFilterChange}>
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Queue" />
        </SelectTrigger>
        <SelectContent>
          {queueOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label} {opt.count > 0 && `(${opt.count})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest first</SelectItem>
          <SelectItem value="oldest">Oldest first</SelectItem>
          <SelectItem value="priority">Highest priority</SelectItem>
          <SelectItem value="waiting_longest">Waiting longest</SelectItem>
          <SelectItem value="unresolved">Unresolved first</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
