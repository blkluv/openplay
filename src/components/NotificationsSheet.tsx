import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bell, Heart, MessageSquare, Zap, User } from 'lucide-react';
import { useNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/hooks/useNotifications';
import { useAuthor } from '@/hooks/useAuthor';
import { formatRelativeTime } from '@/lib/videoUtils';
import { hexToNpub } from '@/lib/nostrUtils';
import type { Notification } from '@/hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onRead: () => void;
}

function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const { data: author } = useAuthor(notification.author);
  const [hasRead, setHasRead] = useState(notification.read);

  const handleClick = () => {
    if (!hasRead) {
      markNotificationAsRead(notification.id);
      setHasRead(true);
      onRead();
    }
  };

  const getIcon = () => {
    if (notification.type === 'reaction') {
      return <Heart className="h-4 w-4 text-red-500" />;
    }
    if (notification.type === 'comment') {
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
    }
    return <Zap className="h-4 w-4 text-yellow-500" />;
  };

  const getMessage = () => {
    const authorName = author?.metadata?.name || author?.metadata?.display_name || 'Someone';
    if (notification.type === 'reaction') {
      return `${authorName} liked your video`;
    }
    if (notification.type === 'comment') {
      return `${authorName} commented on your video`;
    }
    return `${authorName} zapped your video`;
  };

  return (
    <Link
      to={`/watch/${notification.videoId}`}
      onClick={handleClick}
      className={`block p-4 hover:bg-muted transition-colors border-b ${
        !hasRead ? 'bg-muted/50' : ''
      }`}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-1">{getIcon()}</div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={author?.metadata?.picture} />
              <AvatarFallback>
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{getMessage()}</p>
              {notification.videoTitle && (
                <p className="text-xs text-muted-foreground truncate">
                  {notification.videoTitle}
                </p>
              )}
              {notification.type === 'comment' && notification.content && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  "{notification.content}"
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {formatRelativeTime(notification.created_at)}
              </p>
            </div>
          </div>
          {!hasRead && (
            <div className="flex justify-end">
              <div className="h-2 w-2 rounded-full bg-primary" />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

interface NotificationsSheetProps {
  children: React.ReactNode;
}

export function NotificationsSheet({ children }: NotificationsSheetProps) {
  const [open, setOpen] = useState(false);
  const { data: notifications, isLoading, refetch } = useNotifications();
  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  const handleMarkAllAsRead = () => {
    if (notifications) {
      const allIds = notifications.map((n) => n.id);
      markAllNotificationsAsRead(allIds);
      refetch();
    }
  };

  const handleNotificationRead = () => {
    refetch();
  };

  // Refetch when sheet opens
  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  return (
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <SheetTrigger asChild>
        <div className="relative">
          {children}
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </div>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="px-4 py-3 pr-12 border-b">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <SheetTitle>Notifications</SheetTitle>
            {notifications && notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="text-xs self-start sm:self-auto"
              >
                Mark all as read
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-4rem)]">
          {isLoading && (
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && (!notifications || notifications.length === 0) && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                You'll be notified when someone comments or reacts to your videos
              </p>
            </div>
          )}

          {!isLoading && notifications && notifications.length > 0 && (
            <div>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={handleNotificationRead}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
