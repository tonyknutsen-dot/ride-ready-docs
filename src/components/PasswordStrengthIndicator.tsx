import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

interface StrengthResult {
  score: number;
  label: string;
  color: string;
  bgColor: string;
}

export function getPasswordStrength(password: string): StrengthResult {
  if (!password) {
    return { score: 0, label: '', color: '', bgColor: 'bg-muted' };
  }

  let score = 0;
  
  // Length checks
  if (password.length >= 6) score += 1;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  
  // Character variety checks
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  
  // Bonus for very long passwords
  if (password.length >= 16) score += 1;

  // Map score to strength level
  if (score <= 2) {
    return { score: 1, label: 'Weak', color: 'text-destructive', bgColor: 'bg-destructive' };
  } else if (score <= 4) {
    return { score: 2, label: 'Fair', color: 'text-orange-500', bgColor: 'bg-orange-500' };
  } else if (score <= 6) {
    return { score: 3, label: 'Good', color: 'text-yellow-500', bgColor: 'bg-yellow-500' };
  } else {
    return { score: 4, label: 'Strong', color: 'text-green-500', bgColor: 'bg-green-500' };
  }
}

export function PasswordStrengthIndicator({ password, className }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  if (!password) return null;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-200',
              level <= strength.score ? strength.bgColor : 'bg-muted'
            )}
          />
        ))}
      </div>
      <p className={cn('text-xs font-medium', strength.color)}>
        {strength.label}
      </p>
    </div>
  );
}
