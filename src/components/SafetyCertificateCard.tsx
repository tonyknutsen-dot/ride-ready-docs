import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, CheckCircle, Clock, ExternalLink, Upload, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tables } from '@/integrations/supabase/types';
import { format, differenceInDays, isPast, isFuture } from 'date-fns';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

interface SafetyCertificateCardProps {
  ride: Ride;
  onUploadClick?: () => void;
}

type Document = Tables<'documents'>;

// Document types that qualify as safety certificates
const SAFETY_CERT_TYPES = [
  'declaration_of_compliance',
  'doc_certificate',
  'adips_certificate',
  'pipa_certificate',
  'safety_certificate',
  'inspection_certificate'
];

const SafetyCertificateCard = ({ ride, onUploadClick }: SafetyCertificateCardProps) => {
  const { user } = useAuth();
  const [certificate, setCertificate] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);

  // Determine certificate terminology based on category
  const isInflatable = ride.ride_categories.category_group === 'Inflatables';
  const certName = isInflatable 
    ? 'Safety Certificate (PIPA/DOC)' 
    : 'Declaration of Compliance (DOC)';
  const certDescription = isInflatable
    ? 'PIPA or ADIPS certificate for inflatable devices'
    : 'Annual safety inspection certificate';

  useEffect(() => {
    loadSafetyCertificate();
  }, [ride.id, user]);

  const loadSafetyCertificate = async () => {
    if (!user) return;

    try {
      // Find the most recent safety certificate for this ride
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .eq('ride_id', ride.id)
        .eq('is_latest_version', true)
        .in('document_type', SAFETY_CERT_TYPES)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setCertificate(data);
    } catch (error) {
      console.error('Error loading safety certificate:', error);
    } finally {
      setLoading(false);
    }
  };

  const getExpiryStatus = () => {
    if (!certificate?.expires_at) {
      return { status: 'unknown', label: 'No expiry set', color: 'bg-muted text-muted-foreground' };
    }

    const expiryDate = new Date(certificate.expires_at);
    const daysUntilExpiry = differenceInDays(expiryDate, new Date());

    if (isPast(expiryDate)) {
      return { 
        status: 'expired', 
        label: 'EXPIRED', 
        color: 'bg-destructive text-destructive-foreground',
        days: Math.abs(daysUntilExpiry)
      };
    }

    if (daysUntilExpiry <= 7) {
      return { 
        status: 'critical', 
        label: `${daysUntilExpiry} days left`, 
        color: 'bg-destructive text-destructive-foreground',
        days: daysUntilExpiry
      };
    }

    if (daysUntilExpiry <= 30) {
      return { 
        status: 'warning', 
        label: `${daysUntilExpiry} days left`, 
        color: 'bg-amber-500 text-white',
        days: daysUntilExpiry
      };
    }

    return { 
      status: 'valid', 
      label: 'Valid', 
      color: 'bg-success text-success-foreground',
      days: daysUntilExpiry
    };
  };

  const handleViewDocument = async () => {
    if (!certificate) return;

    try {
      const { data } = await supabase.storage
        .from('ride-documents')
        .createSignedUrl(certificate.file_path, 3600);

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error opening document:', error);
    }
  };

  if (loading) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 animate-pulse">
        <CardContent className="p-5">
          <div className="h-20 bg-muted/50 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  // No certificate uploaded
  if (!certificate) {
    return (
      <Card className="border-2 border-dashed border-amber-500/50 bg-gradient-to-r from-amber-500/5 to-amber-500/10">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-7 w-7 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-base text-amber-600 dark:text-amber-400">
                    No {certName}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {certDescription}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Upload your safety certificate to track expiry and share with councils
              </p>
              {onUploadClick && (
                <Button 
                  size="sm" 
                  className="mt-3"
                  onClick={onUploadClick}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Certificate
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Certificate exists
  const expiryInfo = getExpiryStatus();
  const StatusIcon = expiryInfo.status === 'valid' ? CheckCircle : 
                     expiryInfo.status === 'expired' ? AlertTriangle : Clock;

  return (
    <Card className={`border-2 ${
      expiryInfo.status === 'valid' ? 'border-success/30 bg-gradient-to-r from-success/5 to-success/10' :
      expiryInfo.status === 'expired' ? 'border-destructive/30 bg-gradient-to-r from-destructive/5 to-destructive/10' :
      'border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-amber-500/10'
    }`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
            expiryInfo.status === 'valid' ? 'bg-success/20' :
            expiryInfo.status === 'expired' ? 'bg-destructive/20' :
            'bg-amber-500/20'
          }`}>
            <Shield className={`h-7 w-7 ${
              expiryInfo.status === 'valid' ? 'text-success' :
              expiryInfo.status === 'expired' ? 'text-destructive' :
              'text-amber-500'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className={`font-bold text-base ${
                  expiryInfo.status === 'valid' ? 'text-success' :
                  expiryInfo.status === 'expired' ? 'text-destructive' :
                  'text-amber-600 dark:text-amber-400'
                }`}>
                  {certName}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5 truncate max-w-[200px]">
                  {certificate.document_name}
                </p>
              </div>
              <Badge className={`${expiryInfo.color} shrink-0`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {expiryInfo.label}
              </Badge>
            </div>
            
            {certificate.expires_at && (
              <p className="text-xs text-muted-foreground mt-2">
                {expiryInfo.status === 'expired' 
                  ? `Expired on ${format(new Date(certificate.expires_at), 'dd MMM yyyy')}`
                  : `Expires ${format(new Date(certificate.expires_at), 'dd MMM yyyy')}`
                }
              </p>
            )}
            
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleViewDocument}
              >
                <Eye className="h-4 w-4 mr-2" />
                View
              </Button>
              {onUploadClick && (
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={onUploadClick}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Update
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SafetyCertificateCard;