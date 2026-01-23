import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTester } from '@/contexts/TesterContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import PageHeader from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { 
  Bug, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  ExternalLink,
  Calendar,
  Monitor
} from 'lucide-react';
import { format } from 'date-fns';

interface BugReport {
  id: string;
  reference_id: string;
  title: string;
  description: string;
  severity: string;
  issue_type: string;
  status: string;
  current_route: string | null;
  device_type: string | null;
  app_version: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: 'New', color: 'bg-blue-500', icon: Clock },
  in_progress: { label: 'Being Fixed', color: 'bg-yellow-500', icon: RefreshCw },
  fixed: { label: 'Fixed', color: 'bg-green-500', icon: CheckCircle2 },
  needs_retest: { label: 'Needs Retest', color: 'bg-purple-500', icon: AlertCircle },
  closed: { label: 'Closed', color: 'bg-gray-500', icon: CheckCircle2 },
};

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700 border-gray-300',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  high: 'bg-orange-100 text-orange-700 border-orange-300',
  critical: 'bg-red-100 text-red-700 border-red-300',
};

const MyBugReports = () => {
  const { user } = useAuth();
  const { isTester } = useTester();
  const navigate = useNavigate();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (user) {
      loadReports();
    }
  }, [user]);

  const loadReports = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('bug_reports')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error loading bug reports:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark notifications as read when viewing needs_retest tab
  useEffect(() => {
    if (activeTab === 'needs_retest' && user) {
      markNotificationsRead();
    }
  }, [activeTab, user]);

  const markNotificationsRead = async () => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('type', 'bug_status')
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking notifications read:', error);
    }
  };

  const handleGoToPage = (route: string | null) => {
    if (route) {
      navigate(route);
    }
  };

  const filteredReports = reports.filter(report => {
    if (activeTab === 'all') return true;
    if (activeTab === 'needs_retest') return report.status === 'needs_retest';
    if (activeTab === 'open') return ['new', 'in_progress'].includes(report.status);
    if (activeTab === 'resolved') return ['fixed', 'closed'].includes(report.status);
    return true;
  });

  const needsRetestCount = reports.filter(r => r.status === 'needs_retest').length;

  if (!isTester && !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <EmptyState
          icon={Bug}
          title="Access Restricted"
          description="This page is only available to testers."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingState message="Loading your bug reports..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <header className="border-b-2 border-warning/30 bg-gradient-to-r from-warning/5 to-transparent backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <PageHeader
            icon={<Bug className="h-5 w-5 text-warning" />}
            iconBgClass="from-warning/20 to-warning/10"
            title="My Bug Reports"
            subtitle="Track the status of issues you've reported"
            showBackButton
            backTo="/settings"
          />
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 space-y-5">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{reports.length}</p>
              <p className="text-xs text-muted-foreground">Total Reports</p>
            </CardContent>
          </Card>
          <Card className={`bg-gradient-to-br from-purple-500/10 to-purple-500/20 border-purple-500/30 ${needsRetestCount > 0 ? 'ring-2 ring-purple-500/50' : ''}`}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{needsRetestCount}</p>
              <p className="text-xs text-muted-foreground">Needs Retest</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-500/5 to-yellow-500/10 border-yellow-500/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {reports.filter(r => ['new', 'in_progress'].includes(r.status)).length}
              </p>
              <p className="text-xs text-muted-foreground">Open</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {reports.filter(r => ['fixed', 'closed'].includes(r.status)).length}
              </p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="needs_retest" className="relative">
              Retest
              {needsRetestCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center">
                  {needsRetestCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {filteredReports.length === 0 ? (
              <EmptyState
                icon={Bug}
                title={activeTab === 'needs_retest' ? 'No bugs need retesting' : 'No bug reports found'}
                description={activeTab === 'needs_retest' 
                  ? 'Great! All your reported bugs are being worked on or resolved.'
                  : 'When you report bugs using the bug button, they\'ll appear here.'}
                variant="compact"
              />
            ) : (
              <div className="space-y-3">
                {filteredReports.map(report => {
                  const statusConfig = STATUS_CONFIG[report.status] || STATUS_CONFIG.new;
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <Card 
                      key={report.id}
                      className={`transition-all hover:shadow-md ${
                        report.status === 'needs_retest' 
                          ? 'border-2 border-purple-500/50 bg-purple-500/5' 
                          : ''
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="font-mono text-xs">
                                {report.reference_id}
                              </Badge>
                              <Badge className={`${SEVERITY_COLORS[report.severity]} border text-xs`}>
                                {report.severity}
                              </Badge>
                              <Badge 
                                variant="secondary" 
                                className={`${statusConfig.color} text-white text-xs flex items-center gap-1`}
                              >
                                <StatusIcon className="h-3 w-3" />
                                {statusConfig.label}
                              </Badge>
                            </div>

                            {/* Title */}
                            <h3 className="font-semibold text-sm mb-1 line-clamp-1">
                              {report.title}
                            </h3>

                            {/* Description */}
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {report.description}
                            </p>

                            {/* Meta info */}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(report.created_at), 'dd MMM yyyy')}
                              </span>
                              {report.current_route && (
                                <span className="flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3" />
                                  {report.current_route}
                                </span>
                              )}
                              {report.device_type && (
                                <span className="flex items-center gap-1">
                                  <Monitor className="h-3 w-3" />
                                  {report.device_type}
                                </span>
                              )}
                              {report.app_version && (
                                <Badge variant="outline" className="text-xs py-0">
                                  {report.app_version}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-2 shrink-0">
                            {report.status === 'needs_retest' && report.current_route && (
                              <Button
                                size="sm"
                                onClick={() => handleGoToPage(report.current_route)}
                                className="gap-1 bg-purple-600 hover:bg-purple-700"
                              >
                                <span className="hidden sm:inline">Go to Page</span>
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            )}
                            {report.status !== 'needs_retest' && report.current_route && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleGoToPage(report.current_route)}
                                className="gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default MyBugReports;
