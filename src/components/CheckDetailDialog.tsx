import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  User, 
  MapPin, 
  Cloud, 
  CheckCircle2, 
  XCircle, 
  MinusCircle,
  FileText,
  Clock
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Check = Tables<'checks'>;

interface CheckResult {
  id: string;
  is_checked: boolean;
  result: 'pass' | 'fail' | 'na' | null;
  notes: string | null;
  template_item_id: string;
  daily_check_template_items?: {
    check_item_text: string;
    category: string | null;
  };
}

interface CheckDetailDialogProps {
  check: Check | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CheckDetailDialog = ({ check, open, onOpenChange }: CheckDetailDialogProps) => {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && check) {
      loadCheckResults();
    }
  }, [open, check]);

  const loadCheckResults = async () => {
    if (!check) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('check_results')
        .select(`
          *,
          daily_check_template_items (
            check_item_text,
            category
          )
        `)
        .eq('check_id', check.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setResults((data as CheckResult[]) || []);
    } catch (error) {
      console.error('Error loading check results:', error);
    } finally {
      setLoading(false);
    }
  };

  const getResultIcon = (result: 'pass' | 'fail' | 'na' | null, isChecked: boolean) => {
    if (result === 'pass' || (result === null && isChecked)) {
      return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
    }
    if (result === 'fail') {
      return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
    }
    return <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
  };

  const getResultLabel = (result: 'pass' | 'fail' | 'na' | null, isChecked: boolean) => {
    if (result === 'pass' || (result === null && isChecked)) return 'Pass';
    if (result === 'fail') return 'Fail';
    return 'N/A';
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'passed' ? 'default' : status === 'failed' ? 'destructive' : 'secondary';
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'preopening': return 'Pre-Opening';
      case 'daily': return 'Daily';
      case 'monthly': return 'Monthly';
      case 'yearly': return 'Yearly';
      default: return freq.charAt(0).toUpperCase() + freq.slice(1);
    }
  };

  // Group results by category
  const groupedResults = results.reduce((acc, result) => {
    const category = result.daily_check_template_items?.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(result);
    return acc;
  }, {} as Record<string, CheckResult[]>);

  const stats = {
    passed: results.filter(r => r.result === 'pass' || (r.result === null && r.is_checked)).length,
    failed: results.filter(r => r.result === 'fail').length,
    na: results.filter(r => r.result === 'na' || (!r.is_checked && r.result !== 'fail')).length,
    total: results.length
  };

  if (!check) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        NOTE: We use a definite height (h-[90vh]) instead of only max-height so the
        flex child (ScrollArea) gets a real available height and can scroll.
      */}
      <DialogContent className="max-w-2xl h-[90vh] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Check Record Details
          </DialogTitle>
          <DialogDescription>
            {getFrequencyLabel(check.check_frequency)} check from {format(parseISO(check.check_date), 'PPP')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6 min-h-0">
          <div className="space-y-6 pb-4">
            {/* Header Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Date:</span>
                  <span>{format(parseISO(check.check_date), 'PPP')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Checked By:</span>
                  <span>{check.inspector_name}</span>
                </div>
                {check.compliance_officer && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Compliance:</span>
                    <span>{check.compliance_officer}</span>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Status:</span>
                  {getStatusBadge(check.status)}
                </div>
                {check.weather_conditions && (
                  <div className="flex items-center gap-2 text-sm">
                    <Cloud className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Weather:</span>
                    <span>{check.weather_conditions}</span>
                  </div>
                )}
                {check.location && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="font-medium shrink-0">Location:</span>
                    <span className="line-clamp-2">{check.location}</span>
                  </div>
                )}
              </div>
            </div>

            {check.notes && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium mb-1">Notes:</p>
                <p className="text-sm text-muted-foreground">{check.notes}</p>
              </div>
            )}

            <Separator />

            {/* Statistics */}
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-lg font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total Items</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="text-lg font-bold text-green-600">{stats.passed}</div>
                <div className="text-xs text-muted-foreground">Passed</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                <div className="text-lg font-bold text-destructive">{stats.failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-muted-foreground">{stats.na}</div>
                <div className="text-xs text-muted-foreground">N/A</div>
              </div>
            </div>

            <Separator />

            {/* Check Items */}
            <div className="space-y-4">
              <h4 className="font-medium">Check Items</h4>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-2">Loading check items...</p>
                </div>
              ) : results.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No check items recorded for this check.
                </p>
              ) : (
                Object.entries(groupedResults).map(([category, items]) => (
                  <div key={category} className="space-y-2">
                    <h5 className="text-sm font-medium text-muted-foreground capitalize">{category}</h5>
                    <div className="space-y-1">
                      {items.map((result) => (
                        <div 
                          key={result.id} 
                          className="flex items-start gap-3 p-2 rounded-md border bg-card hover:bg-muted/30 transition-colors"
                        >
                          {getResultIcon(result.result, result.is_checked)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              {result.daily_check_template_items?.check_item_text || 'Unknown item'}
                            </p>
                            {result.notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                Note: {result.notes}
                              </p>
                            )}
                          </div>
                          <Badge 
                            variant={result.result === 'pass' || (result.result === null && result.is_checked) ? 'default' : result.result === 'fail' ? 'destructive' : 'secondary'}
                            className="shrink-0 text-xs"
                          >
                            {getResultLabel(result.result, result.is_checked)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default CheckDetailDialog;
