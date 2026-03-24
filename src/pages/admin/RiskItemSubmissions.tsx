import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Check, X, AlertTriangle, Shield, Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RiskItemSubmission {
  id: string;
  user_id: string;
  item_type: 'hazard' | 'control';
  label: string;
  category: string;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  admin_notes: string | null;
  similarity_group: string | null;
  created_at: string;
}

const RiskItemSubmissions = () => {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<RiskItemSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [typeFilter, setTypeFilter] = useState<'all' | 'hazard' | 'control'>('all');
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadSubmissions();
  }, [filter, typeFilter]);

  const loadSubmissions = async () => {
    setLoading(true);
    let query = supabase
      .from('user_submitted_risk_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }
    if (typeFilter !== 'all') {
      query = query.eq('item_type', typeFilter);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      toast({ title: 'Error loading submissions', description: error.message, variant: 'destructive' });
    } else {
      setSubmissions((data as RiskItemSubmission[]) || []);
    }
    setLoading(false);
  };

  const handleApprove = async (submission: RiskItemSubmission) => {
    setProcessing(submission.id);
    
    const { error } = await supabase
      .from('user_submitted_risk_items')
      .update({
        status: 'approved',
        admin_notes: adminNotes[submission.id] || null
      })
      .eq('id', submission.id);

    if (error) {
      toast({ title: 'Error approving', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Approved', description: `${submission.item_type === 'hazard' ? 'Hazard' : 'Control'} approved and noted for library inclusion.` });
      loadSubmissions();
    }
    setProcessing(null);
  };

  const handleReject = async (submission: RiskItemSubmission) => {
    setProcessing(submission.id);
    
    const { error } = await supabase
      .from('user_submitted_risk_items')
      .update({
        status: 'rejected',
        admin_notes: adminNotes[submission.id] || null
      })
      .eq('id', submission.id);

    if (error) {
      toast({ title: 'Error rejecting', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Rejected', description: 'Submission rejected.' });
      loadSubmissions();
    }
    setProcessing(null);
  };

  const pendingCount = submissions.filter(s => s.status === 'pending').length;
  const hazardCount = submissions.filter(s => s.item_type === 'hazard').length;
  const controlCount = submissions.filter(s => s.item_type === 'control').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-warning" />
            Risk Library Intake
          </h1>
          <p className="text-muted-foreground">
            Review user-created hazards and controls for inclusion in the shared risk library. Users can already use their own items privately.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadSubmissions} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-warning">{pendingCount}</div>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{hazardCount}</div>
            <p className="text-sm text-muted-foreground">Hazards</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{controlCount}</div>
            <p className="text-sm text-muted-foreground">Controls</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="hazard">Hazards</SelectItem>
            <SelectItem value="control">Controls</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Submissions List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="font-semibold">No submissions to review</h3>
            <p className="text-sm text-muted-foreground">All caught up!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => (
            <Card key={submission.id} className={submission.status === 'pending' ? 'border-warning/50' : ''}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={submission.item_type === 'hazard' ? 'destructive' : 'default'}>
                        {submission.item_type === 'hazard' ? <AlertTriangle className="h-3 w-3 mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
                        {submission.item_type}
                      </Badge>
                      <Badge variant="outline">{submission.category}</Badge>
                      <Badge variant={
                        submission.status === 'pending' ? 'secondary' :
                        submission.status === 'approved' ? 'default' : 'destructive'
                      }>
                        {submission.status}
                      </Badge>
                    </div>
                    
                    <p className="font-medium text-lg">{submission.label}</p>
                    
                    <p className="text-xs text-muted-foreground mt-2">
                      Submitted {format(new Date(submission.created_at), 'dd MMM yyyy HH:mm')}
                    </p>
                    
                    {submission.admin_notes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">
                        Admin notes: {submission.admin_notes}
                      </p>
                    )}
                  </div>
                  
                  {submission.status === 'pending' && (
                    <div className="flex flex-col gap-2">
                      <Textarea
                        placeholder="Admin notes (optional)"
                        className="text-sm w-48"
                        rows={2}
                        value={adminNotes[submission.id] || ''}
                        onChange={(e) => setAdminNotes({ ...adminNotes, [submission.id]: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(submission)}
                          disabled={processing === submission.id}
                        >
                          {processing === submission.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4 mr-1" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(submission)}
                          disabled={processing === submission.id}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default RiskItemSubmissions;
