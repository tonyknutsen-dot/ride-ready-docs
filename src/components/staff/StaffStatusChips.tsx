import { ROLE_CONFIG } from '@/utils/permissions';

interface StaffStatusChipsProps {
  total: number;
  managers: number;
  supervisors: number;
  staff: number;
  pending: number;
}

export function StaffStatusChips({ total, managers, supervisors, staff, pending }: StaffStatusChipsProps) {
  const chips = [
    { label: 'Total', count: total, color: 'hsl(var(--foreground))', bg: 'hsl(var(--muted))' },
    { label: 'Managers', count: managers, color: ROLE_CONFIG.manager.color, bg: ROLE_CONFIG.manager.bg },
    { label: 'Supervisors', count: supervisors, color: ROLE_CONFIG.supervisor.color, bg: ROLE_CONFIG.supervisor.bg },
    { label: 'Staff', count: staff, color: ROLE_CONFIG.staff.color, bg: ROLE_CONFIG.staff.bg },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(({ label, count, color, bg }) => (
        <div
          key={label}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ background: bg, color, border: `1px solid ${color}20` }}
        >
          <span>{count}</span>
          <span className="font-medium opacity-80">{label}</span>
        </div>
      ))}
      {pending > 0 && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ background: 'hsl(38 100% 97%)', color: 'hsl(32 95% 30%)', border: '1px solid hsl(38 92% 75%)' }}
        >
          <span>{pending}</span>
          <span className="font-medium opacity-80">Pending</span>
        </div>
      )}
    </div>
  );
}
