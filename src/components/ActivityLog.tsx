import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { History, Download, Eye, Share2, FileText, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

interface AuditLogEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: any;
  created_at: string;
}

const getActionIcon = (action: string) => {
  switch (action) {
    case 'view':
      return <Eye className="h-4 w-4 text-info" />;
    case 'download':
      return <Download className="h-4 w-4 text-success" />;
    case 'share':
    case 'export':
      return <Share2 className="h-4 w-4 text-accent" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
};

const getActionLabel = (action: string) => {
  switch (action) {
    case 'view':
      return 'Viewed';
    case 'download':
      return 'Downloaded';
    case 'share':
      return 'Shared';
    case 'export':
      return 'Exported';
    default:
      return action.charAt(0).toUpperCase() + action.slice(1);
  }
};

interface ActivityLogProps {
  limit?: number;
  showViewAll?: boolean;
}

export function ActivityLog({ limit = 5, showViewAll = true }: ActivityLogProps) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadActivityLog();
    }
  }, [user]);

  const loadActivityLog = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', user.id)
        .in('resource_type', ['document', 'documents'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading activity log:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-2 border-info/30 bg-gradient-to-br from-info/5 to-transparent shadow-elegant">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-info/20 flex items-center justify-center">
              <History className="h-4 w-4 text-info" />
            </div>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-info/30 bg-gradient-to-br from-info/5 to-transparent shadow-elegant">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-info/20 flex items-center justify-center">
            <History className="h-4 w-4 text-info" />
          </div>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Your recent document activity — proof that your data is private
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-6">
            <History className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Document views, downloads, and shares will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-info/10 hover:border-info/20 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center border border-border/50">
                  {getActionIcon(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {getActionLabel(log.action)}{' '}
                    <span className="text-muted-foreground font-normal">
                      {(log.details as any)?.document_name || log.resource_type}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
            
            {showViewAll && logs.length >= limit && (
              <Link to="/settings/activity">
                <Button variant="ghost" size="sm" className="w-full mt-2 text-info hover:text-info/80">
                  View all activity
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        )}
        
        <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/20">
          <p className="text-xs text-success font-medium flex items-center gap-2">
            <span>🔒</span>
            Your data is private. We cannot access your documents.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default ActivityLog;
