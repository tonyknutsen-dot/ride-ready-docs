import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Users } from 'lucide-react';

const RISK_GROUPS = [
  { id: 'Public',                label: 'Public' },
  { id: 'Staff',                 label: 'Other Staff' },
  { id: 'Contractors',           label: 'Contractors' },
  { id: 'Spectators',            label: 'Spectators' },
  { id: 'Operators',             label: 'Operators' },
  { id: 'Maintenance personnel', label: 'Maintenance Staff' },
] as const;

interface WhoAtRiskSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function WhoAtRiskSelector({ value, onChange }: WhoAtRiskSelectorProps) {
  const selectedGroups = value ? value.split(', ').filter(Boolean) : [];
  const isAllPersonsSelected = selectedGroups.includes('All persons');

  const handleCheckChange = (option: string, selected: boolean) => {
    let next = [...selectedGroups];
    if (option === 'All persons') {
      next = selected ? ['All persons'] : [];
    } else {
      if (isAllPersonsSelected) return;
      next = selected
        ? [...next.filter(g => g !== option), option]
        : next.filter(g => g !== option);
    }
    onChange(next.join(', '));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-semibold text-[#0F172A]">Who is at Risk? *</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>Identify all groups who could be harmed by this hazard.</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* All Persons pill toggle */}
      <button
        type="button"
        onClick={() => handleCheckChange('All persons', !isAllPersonsSelected)}
        className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
          isAllPersonsSelected
            ? 'bg-[#DBEAFE] border-[#93C5FD]'
            : 'bg-[#F8FAFC] border-dashed border-[#CBD5E1] hover:border-[#93C5FD]'
        }`}
      >
        <div className="flex items-center gap-3">
          <Users className={`h-4 w-4 shrink-0 ${isAllPersonsSelected ? 'text-[#1E3A8A]' : 'text-slate-400'}`} />
          <div className="flex-1">
            <p className={`text-sm font-semibold ${isAllPersonsSelected ? 'text-[#1E3A8A]' : 'text-[#334155]'}`}>
              All Persons
            </p>
            <p className="text-[12px] text-slate-500 mt-0.5">
              This hazard affects everyone — public, staff, contractors, and all other groups
            </p>
          </div>
          {isAllPersonsSelected && (
            <span className="shrink-0 text-[11px] font-bold text-[#1E3A8A] bg-white/60 px-2 py-0.5 rounded-full border border-[#93C5FD]">
              Selected
            </span>
          )}
        </div>
      </button>

      {/* Divider with pill label */}
      <div className="relative flex items-center">
        <div className="flex-1 border-t border-[#E2E8F0]" />
        <span className="mx-2 px-3 py-1 rounded-full bg-[#F1F5F9] text-[11px] font-medium text-[#64748B] whitespace-nowrap">
          or select specific groups
        </span>
        <div className="flex-1 border-t border-[#E2E8F0]" />
      </div>

      {/* Group pill toggles — always 2 columns, min-w-0 prevents overflow */}
      <div className={`grid grid-cols-2 gap-2 ${isAllPersonsSelected ? 'opacity-40 pointer-events-none' : ''}`}>
        {RISK_GROUPS.map((group) => {
          const isChecked = selectedGroups.includes(group.id);
          return (
            <button
              key={group.id}
              type="button"
              disabled={isAllPersonsSelected}
              onClick={() => handleCheckChange(group.id, !isChecked)}
              style={{ minHeight: '38px' }}
              className={`min-w-0 rounded-xl px-3 py-2 text-[13px] font-medium text-left transition-all border overflow-hidden ${
                isChecked
                  ? 'bg-[#DBEAFE] border-[#93C5FD] text-[#1E3A8A]'
                  : 'bg-[#F1F5F9] border-[#E2E8F0] text-[#334155] hover:border-[#93C5FD]'
              }`}
            >
              <span className="block truncate">{group.label}</span>
            </button>
          );
        })}
      </div>

      {/* Selection summary */}
      {selectedGroups.length > 0 && (
        <p className="text-[12px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-[#E2E8F0]">
          <span className="font-semibold text-slate-700">Selected: </span>
          {selectedGroups.join(', ')}
        </p>
      )}
    </div>
  );
}
