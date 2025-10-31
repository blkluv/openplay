import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useInfiniteVideos } from './useVideos';
import type { NostrEvent } from '@nostrify/nostrify';

export interface Notification {
  id: string;
  type: 'comment' | 'zap' | 'reaction';
  event: NostrEvent;
  videoId: string;
  videoTitle?: string;
  author: string;
  content: string;
  created_at: number;
  read: boolean;
}

export function useNotifications() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  // Get all user's videos to watch for notifications on
  const { data: videosData } = useInfiniteVideos({
    pageSize: 100,
    kinds: [21, 22, 34235, 34236],
    authors: user?.pubkey ? [user.pubkey] : undefined,
  });

  const userVideos = videosData?.pages.flatMap((page) => page.videos) ?? [];
  const videoIds = userVideos.map((v) => v.id);
  const videoTitlesMap = new Map(userVideos.map((v) => [v.id, v.title]));

  return useQuery({
    queryKey: ['notifications', user?.pubkey, videoIds.length],
    queryFn: async () => {
      if (!user?.pubkey || videoIds.length === 0) {
        return [];
      }

      // Fetch reactions (kind 7) and comments (kind 1) on user's videos
      const filters = [
        // Reactions on videos
        {
          kinds: [7],
          '#e': videoIds,
          limit: 100,
        },
        // Comments on videos (kind 1 with 'e' tag referencing video)
        {
          kinds: [1],
          '#e': videoIds,
          limit: 100,
        },
      ];

      const events: NostrEvent[] = [];
      for (const filter of filters) {
        const result = await nostr.query([filter]);
        events.push(...result);
      }

      // Filter out user's own notifications
      const filteredEvents = events.filter((e) => e.pubkey !== user.pubkey);

      // Get read status from localStorage
      const readNotifications = JSON.parse(
        localStorage.getItem('readNotifications') || '[]'
      ) as string[];

      // Convert to notifications
      const notifications: Notification[] = filteredEvents.map((event) => {
        const videoTag = event.tags.find((t) => t[0] === 'e');
        const videoId = videoTag?.[1] || '';
        const isReaction = event.kind === 7;
        const isComment = event.kind === 1;

        return {
          id: event.id,
          type: isReaction ? 'reaction' : 'comment',
          event,
          videoId,
          videoTitle: videoTitlesMap.get(videoId),
          author: event.pubkey,
          content: event.content,
          created_at: event.created_at,
          read: readNotifications.includes(event.id),
        };
      });

      // Sort by most recent first
      notifications.sort((a, b) => b.created_at - a.created_at);

      return notifications;
    },
    enabled: !!user?.pubkey && videoIds.length > 0,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function markNotificationAsRead(notificationId: string) {
  const readNotifications = JSON.parse(
    localStorage.getItem('readNotifications') || '[]'
  ) as string[];

  if (!readNotifications.includes(notificationId)) {
    readNotifications.push(notificationId);
    localStorage.setItem('readNotifications', JSON.stringify(readNotifications));
  }
}

export function markAllNotificationsAsRead(notificationIds: string[]) {
  const readNotifications = JSON.parse(
    localStorage.getItem('readNotifications') || '[]'
  ) as string[];

  const newReadNotifications = [...new Set([...readNotifications, ...notificationIds])];
  localStorage.setItem('readNotifications', JSON.stringify(newReadNotifications));
}
