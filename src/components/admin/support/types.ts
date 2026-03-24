export interface SupportMessage {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  admin_response: string | null;
  responded_at: string | null;
  responded_by: string | null;
  assigned_to: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface SupportReply {
  id: string;
  message_id: string;
  author_id: string;
  body: string;
  is_internal_note: boolean;
  created_at: string;
}

export interface SenderProfile {
  user_id: string;
  full_name: string | null;
  company_name: string | null;
}

export type SupportStatus = 'pending' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'archived';
export type SupportPriority = 'low' | 'normal' | 'high' | 'urgent';
export type SortOption = 'newest' | 'oldest' | 'priority' | 'waiting_longest' | 'unresolved';

export const STATUS_CONFIG: Record<string, { label: string; className: string; icon: string }> = {
  pending: { label: 'New', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: 'clock' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: 'loader' },
  waiting_on_user: { label: 'Waiting on User', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', icon: 'user' },
  resolved: { label: 'Resolved', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: 'check' },
  archived: { label: 'Archived', className: 'bg-muted text-muted-foreground', icon: 'archive' },
};

export const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-muted text-muted-foreground' },
  normal: { label: 'Normal', className: 'bg-secondary text-secondary-foreground' },
  high: { label: 'High', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  urgent: { label: 'Urgent', className: 'bg-destructive/10 text-destructive' },
};
