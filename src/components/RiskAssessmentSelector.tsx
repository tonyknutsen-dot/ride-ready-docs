import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, Clock, ClipboardList, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { EmptyState } from '@/components/EmptyState';
import { RequestRideTypeDialog } from '@/components/RequestRideTypeDialog';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

interface RideRAStats {
  count: number;
  highRiskCount: number;
  pendingControls: number;
  lastReviewed: string | null;
  overallLevel: 'low' | 'medium' | 'high' | 'none';
}

interface RiskAssessmentSelectorProps {
  onRideSelect: (ride: Ride) => void;
}

const RISK_LEVEL_CONFIG = {
  high:   { label: 'High Risk',   bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]', text: 'text-[#991B1B]', dot: 'bg-[#DC2626]' },
  medium: { label: 'Medium Risk', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]', text: 'text-[#92400E]', dot: 'bg-[#F59E0B]' },
  low:    { label: 'Low Risk',    bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]', text: 'text-[#166534]', dot: 'bg-[#16A34A]' },
  none:   { label: 'No Assessment', bg: 'bg-muted/40', border: 'border-border',   text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

const RiskAssessmentSelector = ({ onRideSelect }: RiskAssessmentSelectorProps) => {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const [rides, setRides] = useState<Ride[]>([]);
  const [raStats, setRaStats] = useState<Record<string, RideRAStats>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [openRequest, setOpenRequest] = useState(false);

  // Summary totals
  const summaryTotals = Object.values(raStats).reduce(
    (acc, s) => ({
      total: acc.total + s.count,
      high: acc.high + s.highRiskCount,
      pending: acc.pending + s.pendingControls,
    }),
    { total: 0, high: 0, pending: 0 }
  );

  useEffect(() => {
    if (user && effectiveUserId) {
      loadData();
    }
  }, [user, effectiveUserId]);

  const loadData = async () => {
    try {
      // Load rides
      const { data: ridesData, error: ridesError } = await supabase
        .from('rides')
        .select('*, ride_categories(name, description, category_group)')
        .eq('user_id', effectiveUserId)
        .order('ride_name');

      if (ridesError) throw ridesError;
      const ridesList = (ridesData || []) as Ride[];
      setRides(ridesList);
      setLoading(false);

      if (!ridesList.length) return;

      // Load RA data in parallel with thumbnails
      const rideIds = ridesList.map(r => r.id);
      const [raResult, thumbResult] = await Promise.all([
        supabase
          .from('risk_assessments')
          .select('id, ride_id, overall_status, created_at')
          .in('ride_id', rideIds)
          .eq('user_id', effectiveUserId),
        supabase
          .from('documents')
          .select('id, file_path, ride_id')
          .in('ride_id', rideIds)
          .eq('user_id', effectiveUserId)
          .eq('document_type', 'photo')
          .order('uploaded_at', { ascending: false }),
      ]);

      // Process RA data per ride
      if (raResult.data) {
        const raIds = raResult.data.map(r => r.id);
        let itemsByRA: Record<string, { risk_level: string; status: string }[]> = {};

        if (raIds.length) {
          const { data: items } = await supabase
            .from('risk_assessment_items')
            .select('risk_assessment_id, risk_level, status')
            .in('risk_assessment_id', raIds);

          if (items) {
            for (const item of items) {
              if (!itemsByRA[item.risk_assessment_id]) itemsByRA[item.risk_assessment_id] = [];
              itemsByRA[item.risk_assessment_id].push(item);
            }
          }
        }

        const statsMap: Record<string, RideRAStats> = {};
        for (const ride of ridesList) {
          const rideRAs = raResult.data.filter(r => r.ride_id === ride.id);
          const allItems = rideRAs.flatMap(ra => itemsByRA[ra.id] || []);
          const highCount = allItems.filter(i => i.risk_level === 'high').length;
          const pendingCount = allItems.filter(i => i.status === 'open' || i.status === 'in_progress').length;
          const latest = rideRAs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

          let level: RideRAStats['overallLevel'] = 'none';
          if (allItems.length > 0) {
            if (highCount > 0) level = 'high';
            else if (allItems.some(i => i.risk_level === 'medium')) level = 'medium';
            else level = 'low';
          }

          statsMap[ride.id] = {
            count: rideRAs.length,
            highRiskCount: highCount,
            pendingControls: pendingCount,
            lastReviewed: latest?.created_at || null,
            overallLevel: level,
          };
        }
        setRaStats(statsMap);
      }

      // Process thumbnails
      if (thumbResult.data?.length) {
        const photosByRide = new Map<string, string>();
        for (const doc of thumbResult.data) {
          if (doc.ride_id && !photosByRide.has(doc.ride_id)) {
            photosByRide.set(doc.ride_id, doc.file_path);
          }
        }
        const urlPromises = Array.from(photosByRide.entries()).map(async ([rideId, filePath]) => {
          const { data } = await supabase.storage.from('ride-documents').createSignedUrl(filePath, 3600);
          return { rideId, url: data?.signedUrl };
        });
        const results = await Promise.all(urlPromises);
        const next: Record<string, string> = {};
        for (const { rideId, url } of results) {
          if (url) next[rideId] = url;
        }
        setThumbs(next);
      }
    } catch (err) {
      console.error('RiskAssessmentSelector load error:', err);
      setLoading(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="border rounded-xl animate-pulse">
              <div className="w-full h-32 bg-muted rounded-t-xl" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-3/4 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-11 w-full bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Safety Status Summary Strip */}
      {rides.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center justify-center gap-1 bg-card border border-border rounded-xl p-3 text-center">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#16A34A]" />
              <span className="text-lg font-bold text-foreground">{summaryTotals.total}</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Assessments</span>
          </div>
          <div className={`flex flex-col items-center justify-center gap-1 rounded-xl p-3 text-center border ${summaryTotals.high > 0 ? 'bg-[#FEF2F2] border-[#FECACA]' : 'bg-card border-border'}`}>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${summaryTotals.high > 0 ? 'bg-[#DC2626]' : 'bg-muted-foreground'}`} />
              <span className={`text-lg font-bold ${summaryTotals.high > 0 ? 'text-[#991B1B]' : 'text-foreground'}`}>{summaryTotals.high}</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">High Risks</span>
          </div>
          <div className={`flex flex-col items-center justify-center gap-1 rounded-xl p-3 text-center border ${summaryTotals.pending > 0 ? 'bg-[#FFFBEB] border-[#FDE68A]' : 'bg-card border-border'}`}>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${summaryTotals.pending > 0 ? 'bg-[#F59E0B]' : 'bg-muted-foreground'}`} />
              <span className={`text-lg font-bold ${summaryTotals.pending > 0 ? 'text-[#92400E]' : 'text-foreground'}`}>{summaryTotals.pending}</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Controls Pending</span>
          </div>
        </div>
      )}

      {/* Equipment Grid */}
      {rides.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No equipment added yet"
          description="Add your rides and equipment to begin creating risk assessments."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rides.map((ride) => {
            const stats = raStats[ride.id];
            const levelKey = stats?.overallLevel || 'none';
            const levelCfg = RISK_LEVEL_CONFIG[levelKey];
            const hasNoRA = !stats || stats.count === 0;

            return (
              <div
                key={ride.id}
                onClick={() => onRideSelect(ride)}
                className="group cursor-pointer rounded-xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
              >
                {/* Image */}
                <div className="relative">
                  {thumbs[ride.id] ? (
                    <img
                      src={thumbs[ride.id]}
                      alt={ride.ride_name}
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="w-full h-24 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                      <ShieldCheck className="h-10 w-10 text-primary/30" />
                    </div>
                  )}
                  {/* Risk level overlay badge */}
                  {!hasNoRA && (
                    <div className={`absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${levelCfg.bg} ${levelCfg.border} ${levelCfg.text}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${levelCfg.dot}`} />
                      {levelCfg.label}
                    </div>
                  )}
                  {hasNoRA && (
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E]">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      No Assessment
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-4 space-y-3">
                  {/* Title + category */}
                  <div className="space-y-1.5">
                    <h3 className="font-semibold text-base text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                      {ride.ride_name}
                    </h3>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30 font-medium">
                      {ride.ride_categories.name}
                    </Badge>
                  </div>

                  {/* RA stats row */}
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="bg-muted/50 rounded-lg py-1.5">
                      <div className="text-sm font-bold text-foreground">{stats?.count || 0}</div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Assessments</div>
                    </div>
                    <div className={`rounded-lg py-1.5 ${(stats?.highRiskCount || 0) > 0 ? 'bg-[#FEF2F2]' : 'bg-muted/50'}`}>
                      <div className={`text-sm font-bold ${(stats?.highRiskCount || 0) > 0 ? 'text-[#991B1B]' : 'text-foreground'}`}>{stats?.highRiskCount || 0}</div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wide">High Risk</div>
                    </div>
                    <div className={`rounded-lg py-1.5 ${(stats?.pendingControls || 0) > 0 ? 'bg-[#FFFBEB]' : 'bg-muted/50'}`}>
                      <div className={`text-sm font-bold ${(stats?.pendingControls || 0) > 0 ? 'text-[#92400E]' : 'text-foreground'}`}>{stats?.pendingControls || 0}</div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Pending</div>
                    </div>
                  </div>

                  {/* Last reviewed */}
                  {stats?.lastReviewed && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>Last reviewed {formatDate(stats.lastReviewed)}</span>
                    </div>
                  )}

                  {/* No RA warning */}
                  {hasNoRA && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A]">
                      <AlertTriangle className="h-3.5 w-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
                      <p className="text-[10px] text-[#92400E] leading-snug">
                        Risk assessment required for operational compliance.
                      </p>
                    </div>
                  )}

                  {/* CTA */}
                  <Button
                    onClick={(e) => { e.stopPropagation(); onRideSelect(ride); }}
                    className="w-full h-10 text-xs font-semibold"
                    variant={hasNoRA ? 'outline' : 'default'}
                  >
                    <ClipboardList className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                    {hasNoRA ? 'Create Risk Assessment' : 'Open Risk Register'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RequestRideTypeDialog open={openRequest} onOpenChange={setOpenRequest} />
    </div>
  );
};

export default RiskAssessmentSelector;
