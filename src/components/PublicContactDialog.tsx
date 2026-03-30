import { useState } from 'react';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageCircle } from 'lucide-react';

interface PublicContactDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerLabel?: string;
  triggerVariant?: 'default' | 'ghost' | 'outline';
  triggerClassName?: string;
}

export const PublicContactDialog = ({ 
  open: externalOpen, 
  onOpenChange: externalOnOpenChange,
  triggerLabel = 'Contact Us',
  triggerVariant = 'outline',
  triggerClassName = ''
}: PublicContactDialogProps) => {
  const { isOn } = usePlatformSettings();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    enquiryType: 'general',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      // Call edge function to send the enquiry email
      const { error } = await supabase.functions.invoke('send-public-enquiry', {
        body: {
          name: formData.name.trim(),
          email: formData.email.trim(),
          company: formData.company.trim() || 'Not specified',
          enquiryType: formData.enquiryType,
          message: formData.message.trim(),
        },
      });

      if (error) throw error;

      toast.success('Message sent successfully! We\'ll be in touch soon.');
      setFormData({ name: '', email: '', company: '', enquiryType: 'general', message: '' });
      setOpen(false);
    } catch (error: any) {
      console.error('Error sending enquiry:', error);
      toast.error('Failed to send message. Please try again or email us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {externalOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant={triggerVariant} size="lg" className={triggerClassName}>
            <MessageCircle className="h-4 w-4 mr-2" />
            {triggerLabel}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]">
        {!isOn('public_enquiries_enabled') ? (
          <>
            <DialogHeader>
              <DialogTitle>Contact Unavailable</DialogTitle>
              <DialogDescription>
                Public enquiries are temporarily unavailable. Please check back later.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </>
        ) : (
        <>
        <DialogHeader>
          <DialogTitle>Get in Touch</DialogTitle>
          <DialogDescription>
            Have questions about Ride Ready? We'd love to hear from you.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your name"
                maxLength={100}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
                maxLength={200}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="company">Company / Business Name</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Your company name (optional)"
              maxLength={200}
            />
          </div>

          <div>
            <Label htmlFor="enquiryType">Enquiry Type</Label>
            <Select
              value={formData.enquiryType}
              onValueChange={(value) => setFormData({ ...formData, enquiryType: value })}
            >
              <SelectTrigger id="enquiryType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Enquiry</SelectItem>
                <SelectItem value="sales">Sales / Pricing</SelectItem>
                <SelectItem value="demo">Request a Demo</SelectItem>
                <SelectItem value="partnership">Partnership</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="How can we help you?"
              rows={5}
              maxLength={2000}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formData.message.length}/2000 characters
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </Button>
          </div>
        </form>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
};
