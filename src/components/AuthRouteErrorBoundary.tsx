import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import appLogo from '@/assets/app-logo.jpg';

const RECOVERY_ROUTE_ERROR_MESSAGE =
  'We could not open the password reset page. Please request a new reset link.';

function AuthRouteFallback() {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md min-w-0">
        <div className="flex flex-col items-center text-center mb-6">
          <img src={appLogo} alt="Ride Ready Docs" className="h-14 w-14 rounded-lg mb-3" />
          <h1 className="text-xl font-semibold text-foreground">Password reset problem</h1>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-3 rounded-md border border-destructive/50 p-4 text-left text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p className="text-sm" style={{ overflowWrap: 'anywhere' }}>
                {RECOVERY_ROUTE_ERROR_MESSAGE}
              </p>
            </div>
            <div className="grid gap-2">
              <Button onClick={() => window.location.assign('/auth?reset=true')} className="w-full">
                Request new reset link
              </Button>
              <Button variant="outline" onClick={() => window.location.assign('/auth')} className="w-full">
                Back to sign in
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export class AuthRouteErrorBoundary extends React.Component<
  { children: React.ReactNode; resetKey?: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: { resetKey?: string }) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error) {
    console.error('[RESET-RECOVERY] route render failed', {
      message: error.message,
      name: error.name,
    });
  }

  render() {
    if (this.state.hasError) return <AuthRouteFallback />;
    return this.props.children;
  }
}
