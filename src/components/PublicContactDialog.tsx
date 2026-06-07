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
import { MessageCircle } from 'lucide-react';
import appLogo from '@/assets/app-logo.jpg';

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
    phone: '',
    company: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('send-public-enquiry', {
        body: {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || '',
          company: formData.company.trim() || '',
          enquiryType: 'general',
          message: formData.message.trim(),
          source: typeof window !== 'undefined' ? window.location.href : 'unknown',
          timestamp: new Date().toISOString(),
        },
      });

      if (error) throw error;

      toast.success("Thanks — your message has been sent. We'll reply by email.");
      setFormData({ name: '', email: '', phone: '', company: '', message: '' });
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
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden">
        {!isOn('public_enquiries_enabled') ? (
          <div className="p-6">
            <DialogHeader>
              <DialogTitle>Contact Unavailable</DialogTitle>
              <DialogDescription>
                Public enquiries are temporarily unavailable. Please check back later.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        ) : (
        <>
        {/* Branded header */}
        <div className="bg-[hsl(215_55%_16%)] text-white px-6 py-5 flex items-center gap-3 border-b-2 border-accent/60">
          <img src={appLogo} alt="Ride Ready Docs" className="h-10 w-10 rounded-full ring-2 ring-white/20 shrink-0" />
          <div className="min-w-0">
            <DialogTitle className="text-white text-lg leading-tight">Contact Ride Ready Docs</DialogTitle>
            <DialogDescription className="text-white/75 text-sm mt-0.5">
              Send us a message and we'll reply by email.
            </DialogDescription>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Your phone number"
                maxLength={50}
              />
            </div>
            <div>
              <Label htmlFor="company">Business / Organisation (optional)</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Your business name"
                maxLength={200}
              />
            </div>
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
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-sm"
            >
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
