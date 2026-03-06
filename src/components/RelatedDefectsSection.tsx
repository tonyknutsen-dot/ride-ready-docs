import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertOctagon, ChevronDown, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface RelatedDefectsSectionProps {
  rideId: string;
  rideName: string;
}

interface DefectSummary {
  id: string;
  description: string;
  severity: string;
  status: string;
  reported_at: string;
}

const RelatedDefectsSection = ({ rideId, rideName }: RelatedDefectsSectionProps) => {
  const [defects, setDefects] = useState<DefectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('defects')
        .select('id, description, severity, status, reported_at')
        .eq('ride_id', rideId)
        .neq('status', 'resolved')
        .order('reported_at', { ascending: false })
        .limit(5);
      setDefects(data || []);
      setLoading(false);
    };
    load();
  }, [rideId]);

  if (loading || defects.length === 0) return null;

  const stopUseCount = defects.filter(d => d.severity === 'stop_operation').length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border rounded-xl overflow-hidden">
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-2">
            <AlertOctagon className="h-3.5 w-3.5 text-destructive" />
            <span className="text-[13px] font-medium text-foreground">Related Defects</span>
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              {defects.length} open
            </Badge>
            {stopUseCount > 0 && (
              <Badge className="text-[10px] px-1.5 py-0 bg-destructive text-destructive-foreground">
                {stopUseCount} stop-use
              </Badge>
            )}
          </div>
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border px-3 py-2 space-y-2">
          {defects.slice(0, 3).map(d => (
            <div key={d.id} className="flex items-start gap-2 text-[12px]">
              <span className={cn(
                'mt-0.5 h-2 w-2 rounded-full shrink-0',
                d.severity === 'stop_operation' ? 'bg-destructive' :
                d.severity === 'urgent' ? 'bg-orange-500' : 'bg-yellow-500'
              )} />
              <div className="min-w-0">
                <p className="text-foreground line-clamp-1">{d.description}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(d.reported_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
          {defects.length > 3 && (
            <p className="text-[11px] text-muted-foreground">+{defects.length - 3} more</p>
          )}
          <Button asChild variant="outline" size="sm" className="w-full h-9 text-[12px] gap-1.5 mt-1">
            <Link to={`/defects?rideId=${rideId}`}>
              <ExternalLink className="h-3 w-3" />
              View all defects for {rideName}
            </Link>
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default RelatedDefectsSection;
