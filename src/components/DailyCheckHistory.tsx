import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  DownloadCloud,
  PrinterCheck,
  Send,
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
  const [selectedCheckIds, setSelectedCheckIds] = useState<Set<string>>(new Set());
  const [showBulkEmailDialog, setShowBulkEmailDialog] = useState(false);

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

  const generatePDF = (checksToGenerate: InspectionCheck[], isBulk: boolean = false) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    checksToGenerate.forEach((check, checkIndex) => {
      if (checkIndex > 0) {
        doc.addPage();
      }

      let yPos = margin;

      // Branded Header
      doc.setFillColor(41, 128, 185);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('DAILY SAFETY CHECK REPORT', pageWidth / 2, 15, { align: 'center' });
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(check.rides.ride_name, pageWidth / 2, 25, { align: 'center' });
      
      yPos = 45;
      doc.setTextColor(0, 0, 0);

      // Status Badge
      const statusColor: [number, number, number] = check.status === 'passed' ? [40, 167, 69] : 
                         check.status === 'failed' ? [220, 53, 69] : [255, 193, 7];
      doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.roundedRect(margin, yPos, 35, 8, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(check.status.toUpperCase(), margin + 17.5, yPos + 5.5, { align: 'center' });
      doc.setTextColor(0, 0, 0);

      yPos += 15;

      // Ride Information Box
      doc.setFillColor(248, 249, 250);
      doc.roundedRect(margin, yPos, contentWidth, 42, 2, 2, 'F');
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      
      const leftCol = margin + 5;
      const rightCol = pageWidth / 2 + 5;
      let infoY = yPos + 8;

      doc.text('RIDE DETAILS', leftCol, infoY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      infoY += 6;
      doc.text(`Name: ${check.rides.ride_name}`, leftCol, infoY);
      infoY += 5;
      doc.text(`Category: ${check.rides.ride_categories.name}`, leftCol, infoY);
      if (check.rides.manufacturer) {
        infoY += 5;
        doc.text(`Manufacturer: ${check.rides.manufacturer}`, leftCol, infoY);
      }
      if (check.rides.serial_number) {
        infoY += 5;
        doc.text(`Serial: ${check.rides.serial_number}`, leftCol, infoY);
      }

      infoY = yPos + 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('INSPECTION INFO', rightCol, infoY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      infoY += 6;
      doc.text(`Date: ${new Date(check.check_date).toLocaleDateString('en-GB')}`, rightCol, infoY);
      infoY += 5;
      doc.text(`Inspector: ${check.inspector_name}`, rightCol, infoY);
      
      const checkedCount = check.inspection_check_results.filter(r => r.is_checked).length;
      const totalCount = check.inspection_check_results.length;
      const percentage = Math.round((checkedCount/totalCount)*100);
      infoY += 5;
      doc.text(`Completion: ${checkedCount}/${totalCount} (${percentage}%)`, rightCol, infoY);

      yPos += 48;

      // Inspection Items Section
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('Inspection Items', margin, yPos);
      yPos += 8;

      // Items in a clean table format
      check.inspection_check_results.forEach((result, index) => {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = margin;
        }

        const itemBg: [number, number, number] = result.is_checked ? [212, 237, 218] : [248, 215, 218];
        const itemBorder: [number, number, number] = result.is_checked ? [40, 167, 69] : [220, 53, 69];
        
        doc.setFillColor(itemBg[0], itemBg[1], itemBg[2]);
        doc.roundedRect(margin, yPos - 3, contentWidth, 10, 1, 1, 'F');
        
        doc.setDrawColor(itemBorder[0], itemBorder[1], itemBorder[2]);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos - 3, margin, yPos + 7);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        const symbol = result.is_checked ? '✓' : '✗';
        doc.setFont('helvetica', 'bold');
        doc.text(symbol, margin + 3, yPos + 3);
        
        doc.setFont('helvetica', 'normal');
        const itemText = result.daily_check_template_items.check_item_text;
        const maxWidth = contentWidth - 15;
        const lines = doc.splitTextToSize(itemText, maxWidth);
        
        if (lines.length > 1) {
          doc.setFontSize(8);
        }
        doc.text(lines[0], margin + 8, yPos + 3);
        
        if (result.daily_check_template_items.is_required) {
          doc.setTextColor(220, 53, 69);
          doc.text('*', contentWidth + margin - 5, yPos + 3);
          doc.setTextColor(0, 0, 0);
        }

        yPos += 10;

        if (result.notes) {
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          doc.setFont('helvetica', 'italic');
          const noteLines = doc.splitTextToSize(`Note: ${result.notes}`, maxWidth - 5);
          doc.text(noteLines, margin + 8, yPos);
          yPos += noteLines.length * 3.5;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
        }

        yPos += 2;
      });

      // Inspector Notes
      if (check.notes) {
        if (yPos > pageHeight - 35) {
          doc.addPage();
          yPos = margin;
        }
        
        yPos += 5;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(41, 128, 185);
        doc.text('Inspector Notes', margin, yPos);
        yPos += 6;
        
        doc.setFillColor(255, 243, 205);
        const noteLines = doc.splitTextToSize(check.notes, contentWidth - 10);
        const noteHeight = (noteLines.length * 5) + 6;
        doc.roundedRect(margin, yPos - 2, contentWidth, noteHeight, 1, 1, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(noteLines, margin + 5, yPos + 3);
        yPos += noteHeight;
      }

      // Footer
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      const footerY = pageHeight - 10;
      doc.text('Ride Ready Docs - Document Management System', pageWidth / 2, footerY, { align: 'center' });
      doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, pageWidth / 2, footerY + 3, { align: 'center' });
    });

    return doc;
  };

  const handleDownload = (check: InspectionCheck) => {
    const doc = generatePDF([check]);
    doc.save(`daily-check-${check.rides.ride_name}-${check.check_date}.pdf`);
    toast({
      title: "Report downloaded",
      description: "The daily check report has been downloaded",
    });
  };

  const handlePrint = (check: InspectionCheck) => {
    const doc = generatePDF([check]);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    toast({
      title: "Print dialog opened",
      description: "The print dialog has been opened in a new window",
    });
  };

  const handleBulkDownload = () => {
    const selectedChecks = checks.filter(c => selectedCheckIds.has(c.id));
    if (selectedChecks.length === 0) {
      toast({
        title: "No checks selected",
        description: "Please select at least one check to download",
        variant: "destructive",
      });
      return;
    }

    const doc = generatePDF(selectedChecks, true);
    const dateRange = selectedChecks.length > 1 
      ? `${new Date(selectedChecks[selectedChecks.length - 1].check_date).toLocaleDateString()}-${new Date(selectedChecks[0].check_date).toLocaleDateString()}`
      : new Date(selectedChecks[0].check_date).toLocaleDateString();
    doc.save(`daily-checks-bulk-${dateRange}.pdf`);
    
    toast({
      title: "Reports downloaded",
      description: `${selectedChecks.length} reports have been downloaded`,
    });
  };

  const handleBulkPrint = () => {
    const selectedChecks = checks.filter(c => selectedCheckIds.has(c.id));
    if (selectedChecks.length === 0) {
      toast({
        title: "No checks selected",
        description: "Please select at least one check to print",
        variant: "destructive",
      });
      return;
    }

    const doc = generatePDF(selectedChecks, true);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    toast({
      title: "Print dialog opened",
      description: `Printing ${selectedChecks.length} reports`,
    });
  };

  const handleBulkEmail = () => {
    if (selectedCheckIds.size === 0) {
      toast({
        title: "No checks selected",
        description: "Please select at least one check to email",
        variant: "destructive",
      });
      return;
    }
    setShowBulkEmailDialog(true);
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

  const handleSendBulkEmail = async () => {
    if (!recipientEmail) {
      toast({
        title: "Missing information",
        description: "Please enter a recipient email",
        variant: "destructive",
      });
      return;
    }

    const selectedChecks = checks.filter(c => selectedCheckIds.has(c.id));
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-daily-check-report', {
        body: {
          checkIds: Array.from(selectedCheckIds),
          recipientEmail,
          recipientName: recipientName || undefined,
        },
      });

      if (error) throw error;

      toast({
        title: "Reports sent",
        description: `${selectedChecks.length} reports have been sent to ${recipientEmail}`,
      });

      setShowBulkEmailDialog(false);
      setRecipientEmail('');
      setRecipientName('');
      setSelectedCheckIds(new Set());
    } catch (error: any) {
      console.error('Error sending emails:', error);
      toast({
        title: "Error sending reports",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const toggleCheckSelection = (checkId: string) => {
    const newSelection = new Set(selectedCheckIds);
    if (newSelection.has(checkId)) {
      newSelection.delete(checkId);
    } else {
      newSelection.add(checkId);
    }
    setSelectedCheckIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedCheckIds.size === checks.length) {
      setSelectedCheckIds(new Set());
    } else {
      setSelectedCheckIds(new Set(checks.map(c => c.id)));
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
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Daily Check History</span>
              </CardTitle>
              <CardDescription>
                View, download, print, or email completed daily safety checks
              </CardDescription>
            </div>
            {checks.length > 0 && selectedCheckIds.size > 0 && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkDownload}
                >
                  <DownloadCloud className="h-4 w-4 mr-2" />
                  Download ({selectedCheckIds.size})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkPrint}
                >
                  <PrinterCheck className="h-4 w-4 mr-2" />
                  Print ({selectedCheckIds.size})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkEmail}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Email ({selectedCheckIds.size})
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {checks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No daily checks completed yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {checks.length > 1 && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Checkbox
                    checked={selectedCheckIds.size === checks.length}
                    onCheckedChange={toggleSelectAll}
                  />
                  <Label className="cursor-pointer" onClick={toggleSelectAll}>
                    Select All ({checks.length})
                  </Label>
                </div>
              )}
              <div className="space-y-3">
                {checks.map((check) => {
                  const checkedCount = check.inspection_check_results.filter(r => r.is_checked).length;
                  const totalCount = check.inspection_check_results.length;

                  return (
                    <Card key={check.id} className="border">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          {checks.length > 1 && (
                            <Checkbox
                              checked={selectedCheckIds.has(check.id)}
                              onCheckedChange={() => toggleCheckSelection(check.id)}
                              className="mt-1"
                            />
                          )}
                          <div className="flex-1 flex items-start justify-between gap-4 flex-wrap">
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
                              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
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
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
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

      {/* Bulk Email Dialog */}
      <Dialog open={showBulkEmailDialog} onOpenChange={setShowBulkEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Multiple Reports</DialogTitle>
            <DialogDescription>
              Send {selectedCheckIds.size} reports to councils, regulators, or other parties
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="bulkRecipientEmail">Recipient Email *</Label>
              <Input
                id="bulkRecipientEmail"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <Label htmlFor="bulkRecipientName">Recipient Name (Optional)</Label>
              <Input
                id="bulkRecipientName"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkEmailDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendBulkEmail} disabled={sending || !recipientEmail}>
              {sending ? 'Sending...' : `Send ${selectedCheckIds.size} Reports`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DailyCheckHistory;
