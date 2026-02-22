/**
 * Centralised role-based permission checks.
 *
 * Roles (highest → lowest):
 *   controller  – account owner (implicit via organisations.owner_id)
 *   manager     – org member with 'manager' permission_level
 *   supervisor  – org member with 'supervisor' permission_level
 *   staff       – org member with 'staff' permission_level
 *
 * "controller" is a virtual role resolved at runtime from isOwner.
 */

export type AppRole = 'controller' | 'manager' | 'supervisor' | 'staff';

/** Can create / edit / delete calendar (compliance) events */
export const can_create_calendar_event = (role: AppRole): boolean =>
  role === 'controller' || role === 'manager';

/** Can mark a *regulatory* event as complete */
export const can_complete_regulatory = (role: AppRole): boolean =>
  role === 'controller' || role === 'manager';

/** Can mark an *operational* event as complete */
export const can_complete_operational = (_role: AppRole): boolean => true;

/** Can access billing / subscription pages */
export const can_view_billing = (role: AppRole): boolean =>
  role === 'controller';

/** Can invite / remove / change staff roles */
export const can_manage_staff = (role: AppRole): boolean =>
  role === 'controller' || role === 'manager';

/** Can upload compliance documents & certificates */
export const can_upload_documents = (role: AppRole): boolean =>
  role === 'controller' || role === 'manager';

/** Can change another user's role */
export const can_change_role = (actorRole: AppRole, _targetCurrentRole?: AppRole): boolean => {
  if (actorRole === 'controller') return true;
  if (actorRole === 'manager') return true; // can change supervisor/staff only (enforced in UI)
  return false;
};

/** Roles a given actor can assign to others */
export const assignable_roles = (actorRole: AppRole): AppRole[] => {
  if (actorRole === 'controller') return ['manager', 'supervisor', 'staff'];
  if (actorRole === 'manager') return ['supervisor', 'staff'];
  return [];
};

/** Role display config */
export const ROLE_CONFIG: Record<string, {
  label: string;
  description: string;
  color: string;
  bg: string;
  border: string;
}> = {
  controller: {
    label: 'Controller',
    description: 'Account owner. Full access including billing.',
    color: 'hsl(0 72% 40%)',
    bg: 'hsl(0 72% 97%)',
    border: 'hsl(0 72% 85%)',
  },
  manager: {
    label: 'Manager',
    description: 'Full access except billing. Can create calendar events & manage compliance.',
    color: 'hsl(142 72% 25%)',
    bg: 'hsl(142 76% 96%)',
    border: 'hsl(142 69% 70%)',
  },
  supervisor: {
    label: 'Supervisor',
    description: 'Operations lead. Checks, maintenance & compliance completion. Cannot create calendar events.',
    color: 'hsl(32 95% 30%)',
    bg: 'hsl(38 100% 97%)',
    border: 'hsl(38 92% 75%)',
  },
  staff: {
    label: 'Staff',
    description: 'Checks & maintenance only. No compliance admin or calendar creation.',
    color: 'hsl(213 52% 24%)',
    bg: 'hsl(214 100% 97%)',
    border: 'hsl(213 52% 80%)',
  },
};

/** Permission checklist items derived from role */
export const getRolePermissions = (role: AppRole) => [
  { label: 'View rides', granted: true },
  { label: 'Perform checks', granted: true },
  { label: 'Log maintenance', granted: role !== 'staff' || true }, // all roles
  { label: 'View documents', granted: role === 'controller' || role === 'manager' || role === 'supervisor' },
  { label: 'Upload documents', granted: role === 'controller' || role === 'manager' },
  { label: 'Mark compliance complete', granted: role !== 'staff' },
  { label: 'Create calendar events', granted: can_create_calendar_event(role) },
  { label: 'Billing & subscription', granted: can_view_billing(role) },
];
