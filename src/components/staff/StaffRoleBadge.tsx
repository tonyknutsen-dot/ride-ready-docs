import { ROLE_CONFIG, type AppRole } from '@/utils/permissions';
import { CheckCircle2, Crown } from 'lucide-react';

const ROLE_ICONS: Record<string, React.ElementType> = {
  controller: Crown,
  staff: CheckCircle2,
};

interface StaffRoleBadgeProps {
  role: AppRole | string;
  size?: 'sm' | 'md';
}

export function StaffRoleBadge({ role, size = 'sm' }: StaffRoleBadgeProps) {
  // Map legacy roles to staff
  const effectiveRole = (role === 'manager' || role === 'supervisor') ? 'staff' : role;
  const cfg = ROLE_CONFIG[effectiveRole];
  if (!cfg) return null;
  const Icon = ROLE_ICONS[effectiveRole] || CheckCircle2;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      }`}
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2} />
      {cfg.label}
    </span>
  );
}
