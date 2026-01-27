import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const RISK_GROUPS = [
  { id: 'Public', label: 'Public', description: 'Members of the public using the equipment' },
  { id: 'Staff', label: 'Staff', description: 'Employees and workers' },
  { id: 'Contractors', label: 'Contractors', description: 'External contractors and service personnel' },
  { id: 'Spectators', label: 'Spectators', description: 'People watching but not using equipment' },
  { id: 'Operators', label: 'Operators', description: 'Staff operating the equipment' },
  { id: 'Maintenance personnel', label: 'Maintenance', description: 'Those maintaining the equipment' },
] as const;

interface WhoAtRiskSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function WhoAtRiskSelector({ value, onChange }: WhoAtRiskSelectorProps) {
  const selectedGroups = value ? value.split(', ').filter(Boolean) : [];
  const isAllPersonsSelected = selectedGroups.includes('All persons');

  const handleCheckChange = (option: string, checked: boolean) => {
    let newGroups = [...selectedGroups];
    
    if (option === 'All persons') {
      if (checked) {
        // Clear all others and set only "All persons"
        newGroups = ['All persons'];
      } else {
        newGroups = newGroups.filter(g => g !== 'All persons');
      }
    } else {
      // If All persons is selected, don't allow individual selections
      if (isAllPersonsSelected) return;
      
      if (checked) {
        if (!newGroups.includes(option)) {
          newGroups.push(option);
        }
      } else {
        newGroups = newGroups.filter(g => g !== option);
      }
    }
    
    onChange(newGroups.join(', '));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Who is at Risk? *</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>Identify all groups who could be harmed by this hazard. Select "All persons" if the risk applies to everyone.</p>
          </TooltipContent>
        </Tooltip>
      </div>
      
      {/* All Persons Toggle - Prominent */}
      <div 
        className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
          isAllPersonsSelected 
            ? 'border-primary bg-primary/10' 
            : 'border-border hover:border-primary/50 bg-muted/30'
        }`}
        onClick={() => handleCheckChange('All persons', !isAllPersonsSelected)}
      >
        <div className="flex items-center gap-3">
          <Checkbox
            id="risk-all-persons"
            checked={isAllPersonsSelected}
            onCheckedChange={(checked) => handleCheckChange('All persons', !!checked)}
          />
          <div className="flex items-center gap-2 flex-1">
            <Users className="h-4 w-4 text-primary" />
            <Label htmlFor="risk-all-persons" className="text-sm font-medium cursor-pointer">
              All Persons
            </Label>
          </div>
          {isAllPersonsSelected && (
            <Badge variant="secondary" className="text-xs">Selected</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 ml-7">
          This hazard affects everyone - public, staff, contractors, and all other groups
        </p>
      </div>
      
      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or select specific groups</span>
        </div>
      </div>
      
      {/* Individual Groups */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 ${isAllPersonsSelected ? 'opacity-50 pointer-events-none' : ''}`}>
        {RISK_GROUPS.map((group) => {
          const isChecked = selectedGroups.includes(group.id);
          
          return (
            <div
              key={group.id}
              className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all cursor-pointer ${
                isChecked 
                  ? 'border-primary/50 bg-primary/5' 
                  : 'border-border hover:border-primary/30 bg-background'
              } ${isAllPersonsSelected ? 'cursor-not-allowed' : ''}`}
              onClick={() => !isAllPersonsSelected && handleCheckChange(group.id, !isChecked)}
            >
              <Checkbox
                id={`risk-${group.id}`}
                checked={isChecked}
                disabled={isAllPersonsSelected}
                onCheckedChange={(checked) => handleCheckChange(group.id, !!checked)}
              />
              <Label 
                htmlFor={`risk-${group.id}`} 
                className={`text-sm cursor-pointer ${isAllPersonsSelected ? 'cursor-not-allowed' : ''}`}
              >
                {group.label}
              </Label>
            </div>
          );
        })}
      </div>
      
      {/* Selection Summary */}
      {selectedGroups.length > 0 && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
          <span className="font-medium">Selected: </span>
          {selectedGroups.join(', ')}
        </div>
      )}
    </div>
  );
}
