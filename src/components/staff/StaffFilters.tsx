import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

type FilterRole = 'all' | 'staff' | 'pending';

interface StaffFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  activeFilter: FilterRole;
  onFilterChange: (val: FilterRole) => void;
  counts: Record<FilterRole, number>;
}

const FILTER_CHIPS: { value: FilterRole; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'staff', label: 'Staff' },
  { value: 'pending', label: 'Pending' },
];

export function StaffFilters({ search, onSearchChange, activeFilter, onFilterChange, counts }: StaffFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search name or email…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-10 h-11"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
        {FILTER_CHIPS.map(chip => {
          const isActive = activeFilter === chip.value;
          const count = counts[chip.value];
          return (
            <button
              key={chip.value}
              onClick={() => onFilterChange(chip.value)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0"
              style={{
                background: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                color: isActive ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
              }}
            >
              {chip.label}
              {count > 0 && (
                <span
                  className="ml-0.5 px-1.5 py-0 rounded-full text-[10px] font-bold"
                  style={{
                    background: isActive ? 'hsl(var(--primary-foreground) / 0.2)' : 'hsl(var(--border))',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
