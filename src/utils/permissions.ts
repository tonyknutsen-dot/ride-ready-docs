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
  role === 'controller';

/** Can upload compliance documents & certificates */
export const can_upload_documents = (role: AppRole): boolean =>
  role === 'controller' || role === 'manager';
