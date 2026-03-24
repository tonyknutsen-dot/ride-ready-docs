import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { Clock, User, MessageCircle } from 'lucide-react';
import { SupportMessage, SenderProfile, STATUS_CONFIG, PRIORITY_CONFIG } from './types';

interface Props {
  msg: SupportMessage;
  sender: SenderProfile | null;
  replyCount: number;
  onClick: () => void;
}

export function SupportMessageRow({ msg, sender, replyCount, onClick }: Props) {
  const status = STATUS_CONFIG[msg.status] || STATUS_CONFIG.pending;
  const priority = PRIORITY_CONFIG[msg.priority || 'normal'] || PRIORITY_CONFIG.normal;
  const senderName = sender?.full_name || 'Unknown user';
  const orgName = sender?.company_name;
  const activityDate = msg.last_activity_at || msg.updated_at;

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors group"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Left: status indicator */}
          <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${
            msg.status === 'pending' ? 'bg-amber-500' :
            msg.status === 'in_progress' ? 'bg-blue-500' :
            msg.status === 'waiting_on_user' ? 'bg-purple-500' :
            msg.status === 'resolved' ? 'bg-green-500' : 'bg-muted-foreground'
          }`} />

          {/* Center: content */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate max-w-[260px] group-hover:text-primary transition-colors">
                {msg.subject}
              </h3>
              {replyCount > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <MessageCircle className="h-3 w-3" />
                  {replyCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate max-w-[160px]">{senderName}</span>
              {orgName && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="truncate max-w-[120px]">{orgName}</span>
                </>
              )}
            </div>

            <p className="text-xs text-muted-foreground line-clamp-1">{msg.message}</p>
          </div>

          {/* Right: metadata */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge className={`${priority.className} text-[10px] px-1.5 py-0`}>
              {priority.label}
            </Badge>
            <Badge className={`${status.className} text-[10px] px-1.5 py-0`}>
              {status.label}
            </Badge>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {formatDistanceToNow(new Date(activityDate), { addSuffix: true })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
