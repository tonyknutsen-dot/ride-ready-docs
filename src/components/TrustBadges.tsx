import { Shield, Lock, Server, CheckCircle } from 'lucide-react';

interface TrustBadgesProps {
  variant?: 'hero' | 'default';
  className?: string;
}

export default function TrustBadges({ variant = 'default', className = '' }: TrustBadgesProps) {
  const isHero = variant === 'hero';
  
  const badges = [
    {
      icon: Shield,
      label: 'GDPR Compliant',
      description: 'Full data protection'
    },
    {
      icon: Lock,
      label: 'Encrypted',
      description: 'TLS 1.3 & AES-256'
    },
    {
      icon: Server,
      label: 'UK/EU Hosted',
      description: 'Data stays local'
    },
    {
      icon: CheckCircle,
      label: 'ISO 27001 Practices',
      description: 'Enterprise security'
    }
  ];

  return (
    <div className={`flex flex-wrap items-center justify-center gap-4 md:gap-6 ${className}`}>
      {badges.map((badge, index) => (
        <div
          key={index}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
            isHero
              ? 'border-white/20 bg-white/5 backdrop-blur-sm'
              : 'border-border bg-card'
          }`}
        >
          <badge.icon className={`h-4 w-4 ${isHero ? 'text-white' : 'text-primary'}`} />
          <div className="text-left">
            <p className={`text-xs font-semibold leading-tight ${isHero ? 'text-white' : 'text-foreground'}`}>
              {badge.label}
            </p>
            <p className={`text-[10px] leading-tight ${isHero ? 'text-white/70' : 'text-muted-foreground'}`}>
              {badge.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}