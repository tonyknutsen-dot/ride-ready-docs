import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ViewMode = 'cards' | 'list';

interface EquipmentViewToggleProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const EquipmentViewToggle = ({ view, onViewChange }: EquipmentViewToggleProps) => {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewChange('cards')}
        className={cn(
          'h-8 w-8 p-0 rounded-md',
          view === 'cards' && 'bg-background shadow-sm text-foreground',
          view !== 'cards' && 'text-muted-foreground hover:text-foreground'
        )}
        aria-label="Card view"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewChange('list')}
        className={cn(
          'h-8 w-8 p-0 rounded-md',
          view === 'list' && 'bg-background shadow-sm text-foreground',
          view !== 'list' && 'text-muted-foreground hover:text-foreground'
        )}
        aria-label="List view"
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default EquipmentViewToggle;
