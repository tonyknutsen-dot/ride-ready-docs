/**
 * Centralised role-based permission checks.
 *
 * Roles (highest → lowest):
 *   controller  – account owner (implicit via organisations.owner_id)
 *   staff       – org member with 'staff' permission_level
 *
 * "controller" is a virtual role resolved at runtime from isOwner.
 */

export type AppRole = 'controller' | 'staff';

/** Can create / edit / delete calendar (compliance) events */
export const can_create_calendar_event = (role: AppRole): boolean =>
  role === 'controller';

/** Can mark a *regulatory* event as complete */
export const can_complete_regulatory = (role: AppRole): boolean =>
  role === 'controller';

/** Can mark an *operational* event as complete */
export const can_complete_operational = (_role: AppRole): boolean => true;

/** Can access billing / subscription pages */
export const can_view_billing = (role: AppRole): boolean =>
  role === 'controller';

/** Can invite / remove / change staff roles */
export const can_manage_staff = (role: AppRole): boolean =>
  role === 'controller';

/** Can upload compliance documents & certificates */
export const can_upload_documents = (role: AppRole): boolean =>
  role === 'controller';

/** Can change another user's role */
export const can_change_role = (actorRole: AppRole, _targetCurrentRole?: AppRole): boolean => {
  return actorRole === 'controller';
};

/** Roles a given actor can assign to others */
export const assignable_roles = (actorRole: AppRole): AppRole[] => {
  if (actorRole === 'controller') return ['staff'];
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
  staff: {
    label: 'Staff',
    description: 'Can perform checks, maintenance, and other assigned tasks. Cannot access billing or settings.',
    color: 'hsl(213 52% 24%)',
    bg: 'hsl(214 100% 97%)',
    border: 'hsl(213 52% 80%)',
  },
};

/** Permission checklist items derived from role */
export const getRolePermissions = (role: AppRole) => [
  { label: 'View rides', granted: true },
  { label: 'Perform checks', granted: true },
  { label: 'Log maintenance', granted: true },
  { label: 'View documents', granted: role === 'controller' },
  { label: 'Upload documents', granted: role === 'controller' },
  { label: 'Mark compliance complete', granted: role === 'controller' },
  { label: 'Create calendar events', granted: can_create_calendar_event(role) },
  { label: 'Billing & subscription', granted: can_view_billing(role) },
];
