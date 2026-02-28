import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Settings, HelpCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import RideForm from './RideForm';
import RideDetail from './RideDetail';
import { RequestRideTypeDialog } from './RequestRideTypeDialog';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useAllRidesCriticalDefects } from '@/hooks/useOpenCriticalDefects';
import EquipmentFilters, { type SortOption } from './equipment/EquipmentFilters';
import EquipmentViewToggle, { type ViewMode } from './equipment/EquipmentViewToggle';
import EquipmentCardGrid from './equipment/EquipmentCardGrid';
import EquipmentListView from './equipment/EquipmentListView';
import type { Ride } from '@/types/ride';

const VIEW_PREF_KEY = 'rrd-equipment-view';

const RideManagement = () => {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const [rides, setRides] = useState<Ride[]>([]);
  const [rideStats, setRideStats] = useState<Record<string, { docCount: number; checkCount: number; nextDue: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const { data: criticalDefectsMap } = useAllRidesCriticalDefects();

  // View toggle with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(VIEW_PREF_KEY);
      if (saved === 'cards' || saved === 'list') return saved;
    } catch {}
    return 'cards';
  });

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_PREF_KEY, mode); } catch {}
  };

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sort, setSort] = useState<SortOption>('attention');

  // Derived: unique categories from user's rides
  const categories = useMemo(
    () => [...new Set(rides.map((r) => r.ride_categories.name))].sort(),
    [rides]
  );

  // Auto-switch to list view when >6 rides (only on first load)
  useEffect(() => {
    if (!loading && rides.length > 6) {
      try {
        const saved = localStorage.getItem(VIEW_PREF_KEY);
        if (!saved) handleViewChange('list');
      } catch {}
    }
  }, [loading, rides.length]);

  // Filter + sort
  const filteredRides = useMemo(() => {
    let result = rides;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.ride_name.toLowerCase().includes(q) ||
        r.manufacturer?.toLowerCase().includes(q)
      );
    }

    // Category
    if (categoryFilter !== 'all') {
      result = result.filter((r) => r.ride_categories.name === categoryFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      const critA = criticalDefectsMap?.get(a.id) || 0;
      const critB = criticalDefectsMap?.get(b.id) || 0;
      const dueA = rideStats[a.id]?.nextDue;
      const dueB = rideStats[b.id]?.nextDue;

      switch (sort) {
        case 'attention': {
          // Critical first, then has due date, then rest
          if (critA !== critB) return critB - critA;
          if (dueA && !dueB) return -1;
          if (!dueA && dueB) return 1;
          if (dueA && dueB) return new Date(dueA).getTime() - new Date(dueB).getTime();
          return a.ride_name.localeCompare(b.ride_name);
        }
        case 'next-due': {
          if (dueA && !dueB) return -1;
          if (!dueA && dueB) return 1;
          if (dueA && dueB) return new Date(dueA).getTime() - new Date(dueB).getTime();
          return a.ride_name.localeCompare(b.ride_name);
        }
        case 'name-asc':
          return a.ride_name.localeCompare(b.ride_name);
        case 'name-desc':
          return b.ride_name.localeCompare(a.ride_name);
        case 'recent':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [rides, search, categoryFilter, sort, criticalDefectsMap, rideStats]);

  useEffect(() => {
    if (effectiveUserId) {
      loadRides();
    }
  }, [effectiveUserId]);

  const loadRides = async () => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select(`*, ride_categories (name, description, category_group)`)
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading rides:', error);
        toast({ title: "Error loading rides", description: error.message, variant: "destructive" });
      } else {
        setRides(data as Ride[]);
        await loadRideStatistics(data as Ride[]);
      }
    } catch (error) {
      console.error('Error loading rides:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRideStatistics = async (ridesData: Ride[]) => {
    const stats: Record<string, { docCount: number; checkCount: number; nextDue: string | null }> = {};

    for (const ride of ridesData) {
      try {
        const { count: docCount } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', effectiveUserId)
          .eq('ride_id', ride.id);

        const { count: checkCount } = await supabase
          .from('checks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', effectiveUserId)
          .eq('ride_id', ride.id)
          .eq('is_test_data', false);

        const [maintenanceQuery, inspectionQuery, ndtQuery] = await Promise.all([
          supabase.from('maintenance_records').select('next_maintenance_due').eq('user_id', effectiveUserId).eq('ride_id', ride.id).not('next_maintenance_due', 'is', null).order('next_maintenance_due', { ascending: true }).limit(1).maybeSingle(),
          supabase.from('annual_inspection_reports').select('next_inspection_due').eq('user_id', effectiveUserId).eq('ride_id', ride.id).not('next_inspection_due', 'is', null).order('next_inspection_due', { ascending: true }).limit(1).maybeSingle(),
          supabase.from('ndt_reports').select('next_inspection_due').eq('user_id', effectiveUserId).eq('ride_id', ride.id).not('next_inspection_due', 'is', null).order('next_inspection_due', { ascending: true }).limit(1).maybeSingle(),
        ]);

        const dueDates = [
          maintenanceQuery.data?.next_maintenance_due,
          inspectionQuery.data?.next_inspection_due,
          ndtQuery.data?.next_inspection_due,
        ].filter(Boolean).sort();

        stats[ride.id] = { docCount: docCount || 0, checkCount: checkCount || 0, nextDue: dueDates[0] || null };
      } catch (error) {
        console.error(`Error loading stats for ride ${ride.id}:`, error);
        stats[ride.id] = { docCount: 0, checkCount: 0, nextDue: null };
      }
    }

    setRideStats(stats);
  };

  const handleRideAdded = () => {
    setShowAddForm(false);
    loadRides();
    toast({ title: "Ride added successfully", description: "Your new ride has been added to your inventory." });
  };

  if (selectedRide) {
    return <RideDetail ride={selectedRide} onBack={() => setSelectedRide(null)} onUpdate={loadRides} />;
  }

  if (showAddForm) {
    return <RideForm onSuccess={handleRideAdded} onCancel={() => setShowAddForm(false)} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <Settings className="mx-auto h-12 w-12 text-primary animate-spin" />
          <p className="text-muted-foreground">Loading your rides...</p>
        </div>
      </div>
    );
  }

  const showFilters = rides.length >= 4;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold">My Equipment</h2>
            <p className="text-sm text-muted-foreground">
              {rides.length} {rides.length === 1 ? 'item' : 'items'}
            </p>
          </div>
          {rides.length > 0 && (
            <EquipmentViewToggle view={viewMode} onViewChange={handleViewChange} />
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowRequestDialog(true)}
            className="flex items-center gap-1.5"
            size="sm"
          >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Request Type</span>
          </Button>
          <Button
            id="rrd-btn-add-ride"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add Equipment</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <EquipmentFilters
          search={search}
          onSearchChange={setSearch}
          category={categoryFilter}
          onCategoryChange={setCategoryFilter}
          sort={sort}
          onSortChange={setSort}
          categories={categories}
        />
      )}

      {/* Content */}
      {rides.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Settings className="mx-auto h-16 w-16 text-muted-foreground" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">No equipment added yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Add your first ride, stall, or equipment using the button above.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : filteredRides.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No equipment matches your search.</p>
          <Button variant="link" size="sm" onClick={() => { setSearch(''); setCategoryFilter('all'); }}>
            Clear filters
          </Button>
        </div>
      ) : viewMode === 'cards' ? (
        <EquipmentCardGrid
          rides={filteredRides}
          rideStats={rideStats}
          criticalDefectsMap={criticalDefectsMap}
          onSelectRide={setSelectedRide}
        />
      ) : (
        <EquipmentListView
          rides={filteredRides}
          rideStats={rideStats}
          criticalDefectsMap={criticalDefectsMap}
          onSelectRide={setSelectedRide}
        />
      )}

      <RequestRideTypeDialog open={showRequestDialog} onOpenChange={setShowRequestDialog} />
    </div>
  );
};

export default RideManagement;
