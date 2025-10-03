import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, FileText, Share2, Upload, Calendar, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';

type Document = Tables<'documents'>;

interface InsuranceCertificateCardProps {
  onUploadClick?: () => void;
}

const InsuranceCertificateCard = ({ onUploadClick }: InsuranceCertificateCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [insuranceCertificate, setInsuranceCertificate] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadInsuranceCertificate();
    }
  }, [user]);

  const loadInsuranceCertificate = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user?.id)
        .eq('document_type', 'insurance')
        .eq('is_global', true)
        .eq('is_latest_version', true)
        .order('uploaded_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      setInsuranceCertificate(data && data.length > 0 ? data[0] : null);
    } catch (error: any) {
      console.error('Error loading insurance certificate:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getExpiryStatus = () => {
    if (!insuranceCertificate?.expires_at) return { color: 'text-muted-foreground', icon: Shield, text: 'No expiry set' };
    
    const daysUntil = getDaysUntilExpiry(insuranceCertificate.expires_at);
    
    if (daysUntil < 0) {
      return { color: 'text-destructive', icon: AlertTriangle, text: `Expired ${Math.abs(daysUntil)} days ago`, bgColor: 'bg-destructive/10' };
    } else if (daysUntil <= 30) {
      return { color: 'text-amber-600', icon: AlertTriangle, text: `Expires in ${daysUntil} days`, bgColor: 'bg-amber-50 dark:bg-amber-950/30' };
    } else if (daysUntil <= 90) {
      return { color: 'text-blue-600', icon: Calendar, text: `Expires in ${daysUntil} days`, bgColor: 'bg-blue-50 dark:bg-blue-950/30' };
    } else {
      return { color: 'text-emerald-600', icon: CheckCircle, text: `Valid for ${daysUntil} days`, bgColor: 'bg-emerald-50 dark:bg-emerald-950/30' };
    }
  };

  const handleDownload = async () => {
    if (!insuranceCertificate) return;

    try {
      const { data, error } = await supabase.storage
        .from('ride-documents')
        .download(insuranceCertificate.file_path);

      if (error) throw error;

      const blob = new Blob([data]);
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = insuranceCertificate.document_name;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: `Downloading ${insuranceCertificate.document_name}`,
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-24 bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }

  const status = getExpiryStatus();
  const StatusIcon = status.icon;

  return (
    <Card className={`border-2 ${!insuranceCertificate ? 'border-dashed' : status.bgColor || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Insurance Certificate
            </CardTitle>
            <CardDescription>
              Public Liability Insurance - Covers all rides and equipment
            </CardDescription>
          </div>
          {insuranceCertificate && (
            <Badge variant="outline" className={`${status.color} border-current`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!insuranceCertificate ? (
          <div className="text-center py-6 space-y-3">
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-600" />
            <div>
              <p className="font-medium">No Insurance Certificate on file</p>
              <p className="text-sm text-muted-foreground">Upload your insurance policy document</p>
            </div>
            <Button onClick={onUploadClick} className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              Upload Insurance Certificate
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <span className={`text-sm font-semibold ${status.color} flex items-center gap-1`}>
                  <StatusIcon className="h-4 w-4" />
                  {status.text}
                </span>
              </div>
              {insuranceCertificate.expires_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expiry Date</span>
                  <span className="text-sm font-medium">
                    {new Date(insuranceCertificate.expires_at).toLocaleDateString('en-GB')}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Updated</span>
                <span className="text-sm">
                  {new Date(insuranceCertificate.uploaded_at).toLocaleDateString('en-GB')}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleDownload}
              >
                <FileText className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            {insuranceCertificate.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">{insuranceCertificate.notes}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default InsuranceCertificateCard;
