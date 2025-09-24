import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Bell,
  BellRing,
  Check,
  X,
  Mail,
  AlertTriangle,
  Info,
  CheckCircle,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  related_table?: string;
  related_id?: string;
  created_at: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  inspectionReminders: boolean;
  documentExpiry: boolean;
  maintenanceReminders: boolean;
  systemUpdates: boolean;
}

const NotificationCenter = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    inspectionReminders: true,
    documentExpiry: true,
    maintenanceReminders: true,
    systemUpdates: false,
  });
  const [activeTab, setActiveTab] = useState<'notifications' | 'settings'>('notifications');

  useEffect(() => {
    if (user) {
      loadNotifications();
      generateSystemNotifications();
    }
  }, [user]);

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data as Notification[] || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast({
        title: "Error loading notifications",
        description: "Failed to load notifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSystemNotifications = async () => {
    try {
      // Check for overdue inspections
      const today = new Date().toISOString().split('T')[0];
      const { data: overdueInspections } = await supabase
        .from('inspection_checks')
        .select('id, rides(ride_name)')
        .eq('user_id', user?.id)
        .eq('status', 'pending')
        .lt('check_date', today);

      if (overdueInspections && overdueInspections.length > 0) {
        await createNotification(
          'Overdue Inspections',
          `You have ${overdueInspections.length} overdue inspection(s) requiring immediate attention.`,
          'warning'
        );
      }

      // Check for documents expiring soon
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { data: expiringDocs } = await supabase
        .from('documents')
        .select('id, document_name')
        .eq('user_id', user?.id)
        .not('expires_at', 'is', null)
        .lte('expires_at', thirtyDaysFromNow.toISOString().split('T')[0]);

      if (expiringDocs && expiringDocs.length > 0) {
        await createNotification(
          'Documents Expiring Soon',
          `${expiringDocs.length} document(s) will expire within 30 days. Please review and renew as needed.`,
          'warning'
        );
      }
    } catch (error) {
      console.error('Error generating system notifications:', error);
    }
  };

  const createNotification = async (title: string, message: string, type: 'info' | 'warning' | 'error' | 'success') => {
    try {
      // Check if similar notification exists in the last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user?.id)
        .eq('title', title)
        .gte('created_at', yesterday.toISOString());

      if (existing && existing.length > 0) {
        return; // Don't create duplicate notifications
      }

      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: user?.id,
          title,
          message,
          type,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );

      toast({
        title: "All notifications marked as read",
        description: "Your notification list has been cleared",
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'error': return <X className="h-4 w-4 text-destructive" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      default: return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'warning': return 'border-l-amber-500 bg-amber-50/50';
      case 'error': return 'border-l-red-500 bg-red-50/50';
      case 'success': return 'border-l-emerald-500 bg-emerald-50/50';
      default: return 'border-l-blue-500 bg-blue-50/50';
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {unreadCount > 0 ? (
                <BellRing className="h-5 w-5 text-amber-600" />
              ) : (
                <Bell className="h-5 w-5" />
              )}
              Notifications
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadCount}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Stay updated with important alerts and reminders
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant={activeTab === 'notifications' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('notifications')}
            >
              Notifications
            </Button>
            <Button
              variant={activeTab === 'settings' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('settings')}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {activeTab === 'notifications' ? (
          <div className="space-y-4">
            {/* Actions */}
            {notifications.length > 0 && unreadCount > 0 && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllAsRead}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Mark All Read
                </Button>
              </div>
            )}

            {/* Notifications List */}
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No notifications</p>
                <p className="text-sm">You're all caught up!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id}
                    className={cn(
                      "border-l-4 p-4 rounded-lg transition-smooth",
                      getNotificationStyle(notification.type),
                      !notification.is_read && "ring-1 ring-primary/20"
                    )}
                  >
                    <div className="flex items-start justify-between space-x-4">
                      <div className="flex items-start space-x-3 flex-1">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium text-sm">
                              {notification.title}
                            </h4>
                            {!notification.is_read && (
                              <div className="w-2 h-2 bg-primary rounded-full" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteNotification(notification.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Notification Settings */}
            <div className="space-y-4">
              <h3 className="font-medium">Notification Preferences</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, emailNotifications: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="inspection-reminders">Inspection Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified about upcoming and overdue inspections
                    </p>
                  </div>
                  <Switch
                    id="inspection-reminders"
                    checked={settings.inspectionReminders}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, inspectionReminders: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="document-expiry">Document Expiry Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Alerts when documents are approaching expiration
                    </p>
                  </div>
                  <Switch
                    id="document-expiry"
                    checked={settings.documentExpiry}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, documentExpiry: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="maintenance-reminders">Maintenance Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Notifications for scheduled maintenance
                    </p>
                  </div>
                  <Switch
                    id="maintenance-reminders"
                    checked={settings.maintenanceReminders}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, maintenanceReminders: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="system-updates">System Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Information about new features and updates
                    </p>
                  </div>
                  <Switch
                    id="system-updates"
                    checked={settings.systemUpdates}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, systemUpdates: checked }))
                    }
                  />
                </div>
              </div>

              <Button 
                onClick={() => {
                  toast({
                    title: "Settings saved",
                    description: "Your notification preferences have been updated",
                  });
                }}
              >
                Save Preferences
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationCenter;