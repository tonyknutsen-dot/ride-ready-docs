import { Lock, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface RestrictedFeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  requiredPlan?: string; // Kept for backward compat - ignored
}

export const RestrictedFeatureCard: React.FC<RestrictedFeatureCardProps> = ({
  title,
  description,
  icon,
}) => {
  const navigate = useNavigate();
  
  return (
    <Card className="relative overflow-hidden border-border bg-muted/60">
      <div className="absolute inset-0 bg-muted/40" />
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="opacity-50">{icon}</div>
            <div>
              <CardTitle className="text-muted-foreground">{title}</CardTitle>
              <Badge variant="outline" className="mt-1">
                Subscription Required
              </Badge>
            </div>
          </div>
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="relative">
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/billing')}>
          <Zap className="h-4 w-4 mr-2" />
          Subscribe to Access
        </Button>
      </CardContent>
    </Card>
  );
};
