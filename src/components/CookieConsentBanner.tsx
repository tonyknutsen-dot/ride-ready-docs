import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Cookie, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const CONSENT_KEY = 'rrd_cookie_consent';

type ConsentStatus = 'pending' | 'accepted' | 'essential-only';

export default function CookieConsentBanner() {
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored) {
      setStatus(stored as ConsentStatus);
    } else {
      setStatus('pending');
      // Small delay for smooth entrance animation
      setTimeout(() => setVisible(true), 500);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setStatus('accepted');
    setVisible(false);
  };

  const handleEssentialOnly = () => {
    localStorage.setItem(CONSENT_KEY, 'essential-only');
    setStatus('essential-only');
    setVisible(false);
  };

  if (status !== 'pending' || !visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 animate-fade-up">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card border border-border rounded-xl shadow-lg p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            {/* Icon & Content */}
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Cookie className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">Cookie Preferences</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We use cookies to enhance your experience, keep you logged in, and understand how our site is used. 
                  We don't use advertising cookies or sell your data.{' '}
                  <Link to="/cookies" className="text-primary hover:underline">
                    Learn more
                  </Link>
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 md:flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEssentialOnly}
                className="text-sm"
              >
                Essential Only
              </Button>
              <Button
                size="sm"
                onClick={handleAcceptAll}
                className="text-sm"
              >
                Accept All
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}