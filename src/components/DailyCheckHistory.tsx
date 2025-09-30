import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Calendar,
  User,
  Download,
  Printer,
  Mail,
  Eye,
  FileText,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import jsPDF from 'jspdf';

type InspectionCheck = Tables<'inspection_checks'> & {
  rides: {
    ride_name: string;
    manufacturer: string | null;
    serial_number: string | null;
    ride_categories: {
      name: string;
    };
  };
  inspection_check_results: Array<{
    is_checked: boolean;
    notes: string | null;
    daily_check_template_items: {
      check_item_text: string;
      category: string | null;
      is_required: boolean | null;
    };
  }>;
};

interface DailyCheckHistoryProps {
  rideId?: string;
}

const DailyCheckHistory = ({ rideId }: DailyCheckHistoryProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [checks, setChecks] = useState<InspectionCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCheck, setSelectedCheck] = useState<InspectionCheck | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (user) {
      loadChecks();
    }
  }, [user, rideId]);

  const loadChecks = async () => {
    try {
      let query = supabase
        .from('inspection_checks')
        .select(`
          *,
          rides:ride_id (
            ride_name,
            manufacturer,
            serial_number,
            ride_categories (name)
          ),
          inspection_check_results (
            is_checked,
            notes,
            daily_check_template_items:template_item_id (
              check_item_text,
              category,
              is_required
            )
          )
        `)
        .eq('user_id', user?.id)
        .eq('check_frequency', 'daily')
        .order('check_date', { ascending: false });

      if (rideId) {
        query = query.eq('ride_id', rideId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setChecks(data as InspectionCheck[] || []);
    } catch (error: any) {
      console.error('Error loading checks:', error);
      toast({
        title: "Error loading history",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = (check: InspectionCheck) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let yPos = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Daily Safety Check Report', pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(check.rides.ride_name, pageWidth / 2, yPos, { align: 'center' });

    yPos += 15;

    // Details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Inspection Details:', 20, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date(check.check_date).toLocaleDateString()}`, 20, yPos);
    yPos += 6;
    doc.text(`Inspector: ${check.inspector_name}`, 20, yPos);
    yPos += 6;
    doc.text(`Status: ${check.status.toUpperCase()}`, 20, yPos);
    yPos += 6;
    doc.text(`Category: ${check.rides.ride_categories.name}`, 20, yPos);
    yPos += 10;

    const checkedCount = check.inspection_check_results.filter(r => r.is_checked).length;
    const totalCount = check.inspection_check_results.length;
    doc.text(`Completion: ${checkedCount}/${totalCount} (${Math.round((checkedCount/totalCount)*100)}%)`, 20, yPos);
    yPos += 15;

    // Check items
    doc.setFont('helvetica', 'bold');
    doc.text('Inspection Items:', 20, yPos);
    yPos += 7;

    check.inspection_check_results.forEach((result, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFont('helvetica', 'normal');
      const symbol = result.is_checked ? '✓' : '✗';
      const text = `${symbol} ${result.daily_check_template_items.check_item_text}`;
      
      const lines = doc.splitTextToSize(text, pageWidth - 40);
      doc.text(lines, 20, yPos);
      yPos += lines.length * 6;
      
      if (result.notes) {
        doc.setFontSize(8);
        doc.text(`Note: ${result.notes}`, 25, yPos);
        yPos += 5;
        doc.setFontSize(10);
      }
      yPos += 2;
    });

    // Notes
    if (check.notes) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      yPos += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('Inspector Notes:', 20, yPos);
      yPos += 7;
      doc.setFont('helvetica', 'normal');
      const noteLines = doc.splitTextToSize(check.notes, pageWidth - 40);
      doc.text(noteLines, 20, yPos);
    }

    return doc;
  };

  const handleDownload = (check: InspectionCheck) => {
    const doc = generatePDF(check);
    doc.save(`daily-check-${check.rides.ride_name}-${check.check_date}.pdf`);
    toast({
      title: "Report downloaded",
      description: "The daily check report has been downloaded",
    });
  };

  const handlePrint = (check: InspectionCheck) => {
    const doc = generatePDF(check);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    toast({
      title: "Print dialog opened",
      description: "The print dialog has been opened in a new window",
    });
  };

  const handleSendEmail = async () => {
    if (!selectedCheck || !recipientEmail) {
      toast({
        title: "Missing information",
        description: "Please enter a recipient email",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-daily-check-report', {
        body: {
          checkId: selectedCheck.id,
          recipientEmail,
          recipientName: recipientName || undefined,
        },
      });

      if (error) throw error;

      toast({
        title: "Report sent",
        description: `The daily check report has been sent to ${recipientEmail}`,
      });

      setShowEmailDialog(false);
      setRecipientEmail('');
      setRecipientName('');
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: "Error sending report",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading history...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Daily Check History</span>
          </CardTitle>
          <CardDescription>
            View, download, print, or email completed daily safety checks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No daily checks completed yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {checks.map((check) => {
                const checkedCount = check.inspection_check_results.filter(r => r.is_checked).length;
                const totalCount = check.inspection_check_results.length;

                return (
                  <Card key={check.id} className="border">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{check.rides.ride_name}</h4>
                            <Badge variant={
                              check.status === 'passed' ? 'default' : 
                              check.status === 'failed' ? 'destructive' : 
                              'secondary'
                            }>
                              {check.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{new Date(check.check_date).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              <span>{check.inspector_name}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">Completion:</span>
                            <span className="font-medium">{checkedCount}/{totalCount}</span>
                            <span className="text-muted-foreground">
                              ({Math.round((checkedCount/totalCount)*100)}%)
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedCheck(check)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(check)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrint(check)}
                          >
                            <Printer className="h-4 w-4 mr-2" />
                            Print
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCheck(check);
                              setShowEmailDialog(true);
                            }}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Email
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={!!selectedCheck && !showEmailDialog} onOpenChange={() => setSelectedCheck(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Daily Check Details</DialogTitle>
            <DialogDescription>
              Detailed view of the daily safety check
            </DialogDescription>
          </DialogHeader>

          {selectedCheck && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Ride</Label>
                  <p className="font-medium">{selectedCheck.rides.ride_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="font-medium">{selectedCheck.rides.ride_categories.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p className="font-medium">{new Date(selectedCheck.check_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Inspector</Label>
                  <p className="font-medium">{selectedCheck.inspector_name}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground mb-2 block">Inspection Items</Label>
                <div className="space-y-2">
                  {selectedCheck.inspection_check_results.map((result, index) => (
                    <div key={index} className={`p-3 rounded border ${
                      result.is_checked ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        {result.is_checked ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{result.daily_check_template_items.check_item_text}</p>
                          <p className="text-xs text-muted-foreground">
                            {result.daily_check_template_items.category}
                          </p>
                          {result.notes && (
                            <p className="text-sm mt-1 italic">{result.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedCheck.notes && (
                <div>
                  <Label className="text-muted-foreground">Inspector Notes</Label>
                  <p className="mt-1 p-3 bg-muted rounded">{selectedCheck.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Daily Check Report</DialogTitle>
            <DialogDescription>
              Send this report to councils, regulators, or other parties
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="recipientEmail">Recipient Email *</Label>
              <Input
                id="recipientEmail"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <Label htmlFor="recipientName">Recipient Name (Optional)</Label>
              <Input
                id="recipientName"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={sending || !recipientEmail}>
              {sending ? 'Sending...' : 'Send Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DailyCheckHistory;
