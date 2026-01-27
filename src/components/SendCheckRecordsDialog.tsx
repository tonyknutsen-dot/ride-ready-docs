import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Mail, Send, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subDays, startOfYear, endOfYear } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { isCheckRecord, filterCheckRecords, CheckRecordFiltersState, defaultCheckRecordFilters } from './CheckRecordFilters';

interface CheckRecordDocument {
  id: string;
  document_name: string;
  document_type: string;
  uploaded_at: string;
  file_size: number | null;
  notes: string | null;
  file_path: string;
  ride_id: string | null;
}

interface SendCheckRecordsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rideId?: string;
  rideName?: string;
}

const datePresets = [
  { label: 'This Month', getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: 'Last 30 Days', getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: 'Last 90 Days', getValue: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
  { label: 'This Year', getValue: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }) },
];

const checkTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'pre-opening', label: 'Pre-Opening' },
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export const SendCheckRecordsDialog = ({ isOpen, onClose, rideId, rideName }: SendCheckRecordsDialogProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [documents, setDocuments] = useState<CheckRecordDocument[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<CheckRecordFiltersState>(defaultCheckRecordFilters);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadCheckRecords();
    }
  }, [isOpen, user, rideId]);

  const loadCheckRecords = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('documents')
        .select('id, document_name, document_type, uploaded_at, file_size, notes, file_path, ride_id')
        .eq('user_id', user?.id)
        .order('uploaded_at', { ascending: false });

      if (rideId) {
        query = query.eq('ride_id', rideId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter to only check records
      const checkRecords = (data || []).filter(doc => 
        isCheckRecord(doc.document_type, doc.file_path)
      );
      setDocuments(checkRecords);
    } catch (error) {
      console.error('Error loading check records:', error);
      toast.error('Failed to load check records');
    } finally {
      setLoading(false);
    }
  };

  const filteredDocuments = useMemo(() => {
    return filterCheckRecords(documents, filters);
  }, [documents, filters]);

  // Group by month for display
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, CheckRecordDocument[]> = {};
    filteredDocuments.forEach(doc => {
      const monthKey = format(new Date(doc.uploaded_at), 'MMMM yyyy');
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(doc);
    });
    return Object.entries(groups).sort(([a], [b]) => 
      new Date(b).getTime() - new Date(a).getTime()
    );
  }, [filteredDocuments]);

  const totalSelectedSize = useMemo(() => {
    return documents
      .filter(doc => selectedIds.includes(doc.id))
      .reduce((sum, doc) => sum + (doc.file_size || 0), 0);
  }, [documents, selectedIds]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSelectAll = () => {
    const filteredIds = filteredDocuments.map(d => d.id);
    const allSelected = filteredIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const handleToggle = (docId: string) => {
    setSelectedIds(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const handleSend = async () => {
    if (!recipientEmail || selectedIds.length === 0) {
      toast.error('Please enter email and select at least one record');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-batch-documents', {
        body: {
          recipientEmail,
          recipientName,
          message,
          documentIds: selectedIds
        }
      });

      if (error) throw error;

      const successMessage = data.wasSplit 
        ? `Sent ${data.documentsCount} check records across ${data.emailsSent} emails`
        : `Sent ${data.documentsCount} check records successfully`;
      
      toast.success(successMessage);
      onClose();
      setSelectedIds([]);
      setRecipientEmail('');
      setRecipientName('');
      setMessage('');
    } catch (error: any) {
      console.error('Error sending:', error);
      toast.error(error.message || 'Failed to send check records');
    } finally {
      setSending(false);
    }
  };

  const allFilteredSelected = filteredDocuments.length > 0 && 
    filteredDocuments.every(d => selectedIds.includes(d.id));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Send Safety Check Records
          </DialogTitle>
          <DialogDescription>
            {rideName ? `Select check records from ${rideName} to send` : 'Select check records to email to councils or authorities'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Date filters */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {datePresets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => {
                    const { from, to } = preset.getValue();
                    setFilters({ ...filters, dateFrom: from, dateTo: to });
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              <Popover open={fromOpen} onOpenChange={setFromOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal h-8 text-xs",
                      !filters.dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {filters.dateFrom ? format(filters.dateFrom, "dd MMM yyyy") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(date) => {
                      setFilters({ ...filters, dateFrom: date });
                      setFromOpen(false);
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <Popover open={toOpen} onOpenChange={setToOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal h-8 text-xs",
                      !filters.dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {filters.dateTo ? format(filters.dateTo, "dd MMM yyyy") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(date) => {
                      setFilters({ ...filters, dateTo: date });
                      setToOpen(false);
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <Select
                value={filters.checkType}
                onValueChange={(value) => setFilters({ ...filters, checkType: value })}
              >
                <SelectTrigger className="h-8 text-xs w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {checkTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-xs">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(filters.dateFrom || filters.dateTo || filters.checkType !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setFilters(defaultCheckRecordFilters)}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Document list */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No check records found</p>
              {(filters.dateFrom || filters.dateTo) && (
                <p className="text-xs mt-1">Try adjusting your date range</p>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSelectAll}
                >
                  {allFilteredSelected ? 'Deselect All' : `Select All (${filteredDocuments.length})`}
                </Button>
                {selectedIds.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedIds.length} selected ({formatFileSize(totalSelectedSize)})
                  </Badge>
                )}
              </div>

              <ScrollArea className="flex-1 min-h-0 max-h-[200px] border rounded-lg">
                <div className="p-2 space-y-3">
                  {groupedByMonth.map(([month, docs]) => (
                    <div key={month}>
                      <div className="text-xs font-medium text-muted-foreground mb-1.5 px-1">
                        {month} ({docs.length})
                      </div>
                      <div className="space-y-1">
                        {docs.map(doc => (
                          <label
                            key={doc.id}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors",
                              selectedIds.includes(doc.id) 
                                ? "bg-primary/10 border border-primary/30" 
                                : "hover:bg-accent/50 border border-transparent"
                            )}
                          >
                            <Checkbox
                              checked={selectedIds.includes(doc.id)}
                              onCheckedChange={() => handleToggle(doc.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{doc.document_name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {format(new Date(doc.uploaded_at), 'dd MMM yyyy')}
                                {doc.file_size && ` • ${formatFileSize(doc.file_size)}`}
                              </p>
                            </div>
                            {selectedIds.includes(doc.id) && (
                              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {/* Recipient form */}
          <div className="space-y-3 pt-2 border-t">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Email *</Label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="council@example.gov.uk"
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Local Council"
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Message (optional)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Please find attached the safety check records..."
                rows={2}
                className="mt-1 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={sending || selectedIds.length === 0 || !recipientEmail}
            className="gap-2"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Send {selectedIds.length > 0 && `(${selectedIds.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
