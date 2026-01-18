import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTester } from '@/contexts/TesterContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { APP_NAME, APP_VERSION, getLastUpdateDate } from '@/config/appVersion';
import html2canvas from 'html2canvas';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bug, Upload, Loader2, CheckCircle2, AlertTriangle, Camera } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BugReportDialogProps {
  trigger?: React.ReactNode;
}

interface AutoCapturedContext {
  appName: string;
  appVersion: string;
  buildDate: string;
  userRole: string;
  userId: string;
  userEmail: string;
  currentRoute: string;
  deviceType: string;
  browserInfo: string;
  capturedAt: string;
}

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low', description: 'Minor issue, workaround exists' },
  { value: 'medium', label: 'Medium', description: 'Feature impaired but usable' },
  { value: 'high', label: 'High', description: 'Major feature broken' },
  { value: 'critical', label: 'Critical', description: 'App unusable or data at risk' },
];

const ISSUE_TYPE_OPTIONS = [
  { value: 'bug', label: 'Bug' },
  { value: 'ux', label: 'UX Issue' },
  { value: 'data', label: 'Data Problem' },
  { value: 'performance', label: 'Performance' },
  { value: 'other', label: 'Other' },
];

const STEPS_PLACEHOLDER = `1) What were you doing when the issue occurred?
2) What did you click or interact with?
3) What happened next?`;

export const BugReportDialog = ({ trigger }: BugReportDialogProps) => {
  const { user } = useAuth();
  const { isTester } = useTester();
  const location = useLocation();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState(STEPS_PLACEHOLDER);
  const [expectedResult, setExpectedResult] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [issueType, setIssueType] = useState('bug');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isAfterRecentChanges, setIsAfterRecentChanges] = useState(false);
  const pendingScreenshotRef = useRef(false);
  
  // Auto-captured context
  const [context, setContext] = useState<AutoCapturedContext | null>(null);

  // Capture context on dialog open
  useEffect(() => {
    if (open) {
      captureContext();
    }
  }, [open]);

  const captureContext = () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const browserInfo = getBrowserInfo();
    
    setContext({
      appName: APP_NAME,
      appVersion: APP_VERSION,
      buildDate: getLastUpdateDate(),
      userRole: isTester ? 'tester' : 'user',
      userId: user?.id || 'anonymous',
      userEmail: user?.email || 'unknown',
      currentRoute: location.pathname,
      deviceType: isMobile ? 'mobile' : 'desktop',
      browserInfo,
      capturedAt: new Date().toISOString(),
    });
  };

  const getBrowserInfo = (): string => {
    const ua = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = '';

    if (ua.includes('Firefox/')) {
      browserName = 'Firefox';
      browserVersion = ua.split('Firefox/')[1]?.split(' ')[0] || '';
    } else if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
      browserName = 'Chrome';
      browserVersion = ua.split('Chrome/')[1]?.split(' ')[0] || '';
    } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
      browserName = 'Safari';
      browserVersion = ua.split('Version/')[1]?.split(' ')[0] || '';
    } else if (ua.includes('Edg/')) {
      browserName = 'Edge';
      browserVersion = ua.split('Edg/')[1]?.split(' ')[0] || '';
    }

    return `${browserName} ${browserVersion}`.trim();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select an image under 5MB',
          variant: 'destructive',
        });
        return;
      }
      setScreenshotFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const captureScreenshot = async () => {
    // Close dialog, capture, then reopen
    pendingScreenshotRef.current = true;
    setOpen(false);
  };

  // Handle screenshot capture after dialog closes
  useEffect(() => {
    if (!open && pendingScreenshotRef.current) {
      pendingScreenshotRef.current = false;
      
      // Wait for dialog to fully close
      setTimeout(async () => {
        setIsCapturingScreenshot(true);
        
        try {
          // Hide any floating elements
          const floatingBugButton = document.querySelector('[class*="fixed"][class*="bottom"]');
          const testModeBanner = document.querySelector('[class*="TEST MODE"]')?.closest('[class*="fixed"]');
          
          // Store original display values
          const elementsToHide: { el: HTMLElement; display: string }[] = [];
          
          if (floatingBugButton instanceof HTMLElement) {
            elementsToHide.push({ el: floatingBugButton, display: floatingBugButton.style.display });
            floatingBugButton.style.display = 'none';
          }
          if (testModeBanner instanceof HTMLElement) {
            elementsToHide.push({ el: testModeBanner, display: testModeBanner.style.display });
            testModeBanner.style.display = 'none';
          }

          // Small delay to ensure elements are hidden
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Capture the screenshot
          const canvas = await html2canvas(document.body, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
            scale: 1, // Use 1 for faster capture, 2 for higher quality
            logging: false,
            ignoreElements: (element) => {
              // Also ignore via attribute
              return element.hasAttribute('data-hide-from-screenshot');
            }
          });
          
          // Restore hidden elements
          elementsToHide.forEach(({ el, display }) => {
            el.style.display = display;
          });
          
          // Convert canvas to blob
          canvas.toBlob((blob) => {
            if (blob) {
              const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
              setScreenshotFile(file);
              setScreenshotPreview(canvas.toDataURL('image/png'));
              
              toast({
                title: 'Screenshot captured',
                description: 'The screenshot has been attached to your bug report.',
              });
            }
            
            setIsCapturingScreenshot(false);
            setOpen(true);
          }, 'image/png');
          
        } catch (error) {
          console.error('Screenshot capture failed:', error);
          toast({
            title: 'Screenshot failed',
            description: 'Could not capture screenshot. Please upload manually.',
            variant: 'destructive',
          });
          setIsCapturingScreenshot(false);
          setOpen(true);
        }
      }, 300);
    }
  }, [open, toast]);

  const uploadScreenshot = async (): Promise<string | null> => {
    if (!screenshotFile || !user) return null;
    
    const fileExt = screenshotFile.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('bug-attachments')
      .upload(fileName, screenshotFile);

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('bug-attachments')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !context) return;

    setSubmitting(true);

    try {
      // Upload screenshot if provided
      let uploadedUrl = screenshotUrl;
      if (screenshotFile) {
        const uploaded = await uploadScreenshot();
        if (uploaded) uploadedUrl = uploaded;
      }

      // Insert bug report - cast to any for newly created table
      const { data, error } = await supabase
        .from('bug_reports' as any)
        .insert({
          user_id: user.id,
          user_email: context.userEmail,
          user_role: context.userRole,
          title,
          description,
          steps_to_reproduce: stepsToReproduce !== STEPS_PLACEHOLDER ? stepsToReproduce : null,
          expected_result: expectedResult || null,
          actual_result: actualResult || null,
          severity,
          issue_type: issueType,
          screenshot_url: uploadedUrl || null,
          app_name: context.appName,
          app_version: context.appVersion,
          build_date: context.buildDate,
          current_route: context.currentRoute,
          device_type: context.deviceType,
          browser_info: context.browserInfo,
          captured_at: context.capturedAt,
          is_after_recent_changes: isTester ? isAfterRecentChanges : false,
        } as any)
        .select('reference_id')
        .single();

      if (error) throw error;

      const refId = (data as any)?.reference_id;
      setReferenceId(refId);
      setSubmitted(true);

      // Send notification to admin
      try {
        await supabase.functions.invoke('send-bug-report-notification', {
          body: {
            referenceId: refId,
            title,
            severity,
            appVersion: context.appVersion,
            currentRoute: context.currentRoute,
            description,
          },
        });
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError);
      }

      toast({
        title: 'Bug report submitted',
        description: `Reference: ${refId}`,
      });
    } catch (error: any) {
      console.error('Submit error:', error);
      toast({
        title: 'Failed to submit',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStepsToReproduce(STEPS_PLACEHOLDER);
    setExpectedResult('');
    setActualResult('');
    setSeverity('medium');
    setIssueType('bug');
    setScreenshotUrl('');
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setIsAfterRecentChanges(false);
    setSubmitted(false);
    setReferenceId(null);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(resetForm, 300);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Bug className="h-4 w-4" />
            Report a Bug
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] p-0">
        {submitted ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Bug Report Submitted</h3>
              <p className="text-muted-foreground mt-1">
                Thank you for helping improve the app!
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary border">
              <p className="text-sm text-muted-foreground">Your reference number</p>
              <p className="text-2xl font-mono font-bold text-primary">{referenceId}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Save this reference number if you need to follow up.
            </p>
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5 text-destructive" />
                Report a Bug
              </DialogTitle>
              <DialogDescription>
                Help us fix issues by providing details about what went wrong.
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[calc(90vh-120px)]">
              <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-4">
                {/* Auto-captured context display */}
                {context && (
                  <div className="p-3 rounded-lg bg-secondary/50 border text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Version</span>
                      <Badge variant="outline" className="font-mono">{context.appVersion}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Page</span>
                      <span className="font-mono">{context.currentRoute}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Device</span>
                      <span>{context.deviceType} • {context.browserInfo}</span>
                    </div>
                  </div>
                )}

                {/* Tester checkbox */}
                {isTester && (
                  <div className="flex items-center space-x-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                    <Checkbox
                      id="recent-changes"
                      checked={isAfterRecentChanges}
                      onCheckedChange={(checked) => setIsAfterRecentChanges(checked as boolean)}
                    />
                    <Label htmlFor="recent-changes" className="text-sm cursor-pointer">
                      This happened after recent changes
                    </Label>
                  </div>
                )}

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Issue Title *</Label>
                  <Input
                    id="title"
                    placeholder="Brief summary of the issue"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                {/* Severity & Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Severity *</Label>
                    <Select value={severity} onValueChange={setSeverity}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              {opt.value === 'critical' && <AlertTriangle className="h-3 w-3 text-destructive" />}
                              {opt.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Issue Type *</Label>
                    <Select value={issueType} onValueChange={setIssueType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ISSUE_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">What went wrong? *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the issue in detail..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    required
                  />
                </div>

                {/* Steps to reproduce */}
                <div className="space-y-2">
                  <Label htmlFor="steps">Steps to Reproduce</Label>
                  <Textarea
                    id="steps"
                    value={stepsToReproduce}
                    onChange={(e) => setStepsToReproduce(e.target.value)}
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>

                {/* Expected vs Actual */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="expected">Expected Result</Label>
                    <Textarea
                      id="expected"
                      placeholder="What should have happened?"
                      value={expectedResult}
                      onChange={(e) => setExpectedResult(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="actual">Actual Result</Label>
                    <Textarea
                      id="actual"
                      placeholder="What actually happened?"
                      value={actualResult}
                      onChange={(e) => setActualResult(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>

                {/* Screenshot */}
                <div className="space-y-2">
                  <Label>Screenshot (optional)</Label>
                  
                  {/* Capture button */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={captureScreenshot}
                    disabled={isCapturingScreenshot}
                  >
                    <Camera className="h-4 w-4" />
                    {isCapturingScreenshot ? 'Capturing...' : 'Capture Screenshot'}
                  </Button>
                  
                  {/* Screenshot preview */}
                  {screenshotPreview && (
                    <div className="relative">
                      <img 
                        src={screenshotPreview} 
                        alt="Screenshot preview" 
                        className="w-full rounded-md border max-h-32 object-cover object-top"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1 h-6 px-2 text-xs"
                        onClick={() => {
                          setScreenshotFile(null);
                          setScreenshotPreview(null);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                  
                  {!screenshotPreview && (
                    <>
                      <div className="text-xs text-muted-foreground text-center">— or —</div>
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="flex-1"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Or paste a link:
                      </div>
                      <Input
                        placeholder="https://..."
                        value={screenshotUrl}
                        onChange={(e) => setScreenshotUrl(e.target.value)}
                      />
                    </>
                  )}
                </div>

                {/* Submit */}
                <Button type="submit" className="w-full gap-2" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Bug className="h-4 w-4" />
                      Submit Bug Report
                    </>
                  )}
                </Button>
              </form>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BugReportDialog;
