import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SupportAccessGate } from '@/components/SupportAccessGate';
import { useSupportAccess } from '@/hooks/useSupportAccess';
import { supabase } from '@/integrations/supabase/client';
import {
  Eye, Search, Building, Clock, Shield, ShieldOff, FileText,
  AlertTriangle, CheckCircle, Wrench, ClipboardCheck, Package,
  Loader2, ArrowLeft, X,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

/**
 * Admin Support View — the operational page where admins view customer data
 * under an active support access grant.
 *
 * Enforcement model:
 * - Data queries use the standard supabase client
 * - RLS policies on customer tables (rides, documents, checks, defects, etc.)
 *   require admin_has_support_access(auth.uid(), row.user_id) to return true
 * - This page selects a target user, which the hook validates against grants
 * - If the grant is revoked/expired, the 60s poll in useSupportAccess clears
 *   the active target and this page shows the blocked state
 */

interface CustomerSummary {
  rides: number;
  documents: number;
  checks: number;
  defects: number;
  inspectionRecords: number;
  complianceEvents: number;
}

interface RideRow {
  id: string;
  ride_name: string;
  status: string;
  created_at: string;
}

interface DocumentRow {
  id: string;
  document_name: string;
  document_type: string;
  uploaded_at: string;
  expires_at: string | null;
}

interface DefectRow {
  id: string;
  description: string;
  severity: string;
  status: string;
  reported_at: string;
}

export default function SupportViewPage() {
  const {
    activeGrants, activeTargetUserId, activeGrant, loading: grantsLoading,
    canUseSupportAccess, hasGrantForUser, selectTarget, clearTarget, logAccess,
  } = useSupportAccess();

  const [customerData, setCustomerData] = useState<CustomerSummary | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'summary' | 'rides' | 'documents' | 'defects'>('summary');
  const [rides, setRides] = useState<RideRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [defects, setDefects] = useState<DefectRow[]>([]);

  // Customer profiles for grant target selection
  const [profiles, setProfiles] = useState<{ user_id: string; company_name: string | null; controller_name: string | null }[]>([]);

  useEffect(() => {
    if (!canUseSupportAccess) return;
    // Load customer profiles for users with active grants
    const userIds = [...new Set(activeGrants.map(g => g.user_id))];
    if (userIds.length === 0) {
      setProfiles([]);
      return;
    }
    supabase
      .from('profiles')
      .select('user_id, company_name, controller_name')
      .in('user_id', userIds)
      .then(({ data }) => setProfiles(data || []));
  }, [activeGrants, canUseSupportAccess]);

  const fetchCustomerData = useCallback(async (targetUserId: string) => {
    setDataLoading(true);
    try {
      // These queries will only return data if admin_has_support_access RLS passes
      const [ridesRes, docsRes, checksRes, defectsRes, inspRes, compRes] = await Promise.all([
        supabase.from('rides').select('id, ride_name, created_at').eq('user_id', targetUserId),
        supabase.from('documents').select('id, document_name, document_type, uploaded_at, expires_at').eq('user_id', targetUserId),
        supabase.from('checks').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId),
        supabase.from('defects').select('id, description, severity, status, reported_at').eq('user_id', targetUserId),
        supabase.from('inspection_records').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId),
        supabase.from('compliance_events').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId),
      ]);

      setRides((ridesRes.data || []).map((r: any) => ({ ...r, status: 'active' })));
      setDocuments(docsRes.data || []);
      setDefects(defectsRes.data || []);

      setCustomerData({
        rides: ridesRes.data?.length || 0,
        documents: docsRes.data?.length || 0,
        checks: checksRes.count || 0,
        defects: defectsRes.data?.length || 0,
        inspectionRecords: inspRes.count || 0,
        complianceEvents: compRes.count || 0,
      });

      await logAccess('customer_overview', targetUserId);
    } catch (err) {
      console.error('[SupportView] Failed to fetch customer data:', err);
    } finally {
      setDataLoading(false);
    }
  }, [logAccess]);

  // Load data when target changes
  useEffect(() => {
    if (activeTargetUserId) {
      fetchCustomerData(activeTargetUserId);
      setSelectedTab('summary');
    } else {
      setCustomerData(null);
      setRides([]);
      setDocuments([]);
      setDefects([]);
    }
  }, [activeTargetUserId, fetchCustomerData]);

  const getProfileLabel = (userId: string) => {
    const p = profiles.find(pr => pr.user_id === userId);
    return p?.company_name || p?.controller_name || userId.slice(0, 8) + '…';
  };

  const handleSelectCustomer = async (userId: string) => {
    await selectTarget(userId);
  };

  if (grantsLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Support View
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              View customer data under an active support access grant
            </p>
          </div>
        </div>

        {/* Enforcement notice */}
        <Alert className="border-primary/30 bg-primary/5">
          <Shield className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Access is enforced at the database level.</strong> You can only view data for customers
            who have an active, unexpired support access grant. All access is read-only and forensically logged.
          </AlertDescription>
        </Alert>

        {/* Active session banner */}
        {activeTargetUserId && activeGrant && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border-2 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium truncate">
                Viewing: {getProfileLabel(activeTargetUserId)}
              </span>
              <Badge variant="outline" className="text-xs shrink-0">
                {activeGrant.access_scope === 'read_only' ? 'Read-only' : activeGrant.access_scope}
              </Badge>
              <span className="text-xs text-muted-foreground shrink-0">
                Expires {formatDistanceToNow(new Date(activeGrant.expires_at), { addSuffix: true })}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={clearTarget}>
              <X className="h-4 w-4 mr-1" />
              End Session
            </Button>
          </div>
        )}

        {/* Customer selection (no active session) */}
        {!activeTargetUserId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Customer</CardTitle>
            </CardHeader>
            <CardContent>
              {activeGrants.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center space-y-3">
                  <ShieldOff className="h-12 w-12 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    No active support access grants available.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Grants must be created by the customer from their Settings page,
                    or by an admin from the Support Access Grants page.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeGrants.map(grant => (
                    <div
                      key={grant.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <Building className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm">{getProfileLabel(grant.user_id)}</span>
                          <Badge variant="outline" className="text-xs">
                            {grant.access_scope === 'read_only' ? 'Read-only' : grant.access_scope}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{grant.reason}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Expires {formatDistanceToNow(new Date(grant.expires_at), { addSuffix: true })}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleSelectCustomer(grant.user_id)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Customer data view */}
        {activeTargetUserId && (
          <SupportAccessGate
            hasGrant={hasGrantForUser(activeTargetUserId)}
            loading={dataLoading && !customerData}
            targetDescription={getProfileLabel(activeTargetUserId)}
          >
            {/* Data tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {(['summary', 'rides', 'documents', 'defects'] as const).map(tab => (
                <Button
                  key={tab}
                  variant={selectedTab === tab ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs capitalize whitespace-nowrap"
                  onClick={() => {
                    setSelectedTab(tab);
                    logAccess(tab, activeTargetUserId);
                  }}
                >
                  {tab}
                </Button>
              ))}
            </div>

            {/* Summary tab */}
            {selectedTab === 'summary' && customerData && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Equipment', count: customerData.rides, icon: Package },
                  { label: 'Documents', count: customerData.documents, icon: FileText },
                  { label: 'Checks', count: customerData.checks, icon: ClipboardCheck },
                  { label: 'Defects', count: customerData.defects, icon: AlertTriangle },
                  { label: 'Inspections', count: customerData.inspectionRecords, icon: CheckCircle },
                  { label: 'Compliance', count: customerData.complianceEvents, icon: Shield },
                ].map(item => (
                  <Card key={item.label}>
                    <CardContent className="p-4 text-center">
                      <item.icon className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-2xl font-bold">{item.count}</p>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Rides tab */}
            {selectedTab === 'rides' && (
              <Card>
                <CardContent className="p-4">
                  {rides.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No equipment records found</p>
                  ) : (
                    <div className="space-y-2">
                      {rides.map(ride => (
                        <div key={ride.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <p className="text-sm font-medium">{ride.ride_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Added {format(new Date(ride.created_at), 'dd MMM yyyy')}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">{ride.status || 'active'}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Documents tab */}
            {selectedTab === 'documents' && (
              <Card>
                <CardContent className="p-4">
                  {documents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No documents found</p>
                  ) : (
                    <div className="space-y-2">
                      {documents.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.document_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.document_type} · Uploaded {format(new Date(doc.uploaded_at), 'dd MMM yyyy')}
                            </p>
                          </div>
                          {doc.expires_at && (
                            <Badge
                              variant="outline"
                              className={`text-xs shrink-0 ${
                                new Date(doc.expires_at) < new Date()
                                  ? 'border-destructive/50 text-destructive'
                                  : ''
                              }`}
                            >
                              {new Date(doc.expires_at) < new Date() ? 'Expired' : `Exp ${format(new Date(doc.expires_at), 'dd MMM yy')}`}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Defects tab */}
            {selectedTab === 'defects' && (
              <Card>
                <CardContent className="p-4">
                  {defects.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No defects found</p>
                  ) : (
                    <div className="space-y-2">
                      {defects.map(defect => (
                        <div key={defect.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{defect.description}</p>
                            <p className="text-xs text-muted-foreground">
                              Reported {format(new Date(defect.reported_at), 'dd MMM yyyy')}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className="text-xs">{defect.severity}</Badge>
                            <Badge variant="outline" className="text-xs">{defect.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {dataLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </SupportAccessGate>
        )}
      </div>
    </AdminLayout>
  );
}
