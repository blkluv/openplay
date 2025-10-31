import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useAppContext } from './useAppContext';
import type { NostrEvent } from 'nostr-tools';
import { parseVideoEvent, type VideoEvent } from '@/lib/videoUtils';
import { decodeVideoIdentifier } from '@/lib/nostrUtils';

export interface UseVideosOptions {
  limit?: number;
  authors?: string[];
  hashtags?: string[];
  search?: string;
  kinds?: number[];
}

// Video Event Kinds:
// - kind 21: Normal/horizontal videos (new format)
// - kind 34235: Normal/horizontal videos (legacy format - deprecated but supported for backward compatibility)
// - kind 22: Vertical short videos (new format)
// - kind 34236: Vertical short videos (legacy format - deprecated but supported for backward compatibility)

// Default relays to use if user hasn't configured any
const DEFAULT_RELAYS = [
  'wss://relay.ditto.pub',
  'wss://relay.nostr.band',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.snort.social',
];

/**
 * Hook to fetch video events (defaults to horizontal videos: kind 21 and legacy 34235)
 */
export function useVideos(options: UseVideosOptions = {}) {
  const { nostr } = useNostr();
  const { limit = 50, authors, hashtags, search } = options;

  return useQuery({
    queryKey: ['videos', { limit, authors, hashtags, search }],
    queryFn: async ({ signal }) => {
      try {
        const filter: any = {
          kinds: [21, 34235], // Horizontal videos only (new and legacy)
          limit,
        };

        if (authors && authors.length > 0) {
          filter.authors = authors;
        }

        if (hashtags && hashtags.length > 0) {
          filter['#t'] = hashtags;
        }

        if (search) {
          filter.search = search;
        }

        const events = await nostr.query(
          [filter],
          { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) }
        );

        // Parse and deduplicate events
        const videoEvents: VideoEvent[] = [];
        const seenIds = new Set<string>();

        for (const event of events) {
          if (seenIds.has(event.id)) continue;
          seenIds.add(event.id);

          const videoEvent = parseVideoEvent(event);
          if (videoEvent) {
            videoEvents.push(videoEvent);
          }
        }

        // Sort by published_at or created_at
        videoEvents.sort((a, b) => {
          const aTime = a.publishedAt || a.created_at;
          const bTime = b.publishedAt || b.created_at;
          return bTime - aTime;
        });

        // Return empty array if no videos found (this is not an error)
        return videoEvents;
      } catch (error) {
        console.error('Error fetching videos:', error);
        // Return empty array instead of throwing - let the UI handle empty state
        return [];
      }
    },
    staleTime: 60000, // 1 minute
    retry: false, // Don't retry, just show empty state
  });
}

/**
 * Hook to fetch a single video event by ID or naddr (supports all video kinds)
 * Returns both the raw NostrEvent and the parsed VideoEvent
 */
export function useVideo(identifier: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['video', identifier],
    queryFn: async ({ signal }) => {
      // Decode the identifier to determine the query type
      const decodedInfo = decodeVideoIdentifier(identifier);

      let filter: any;

      // Build the appropriate filter based on identifier type
      if (decodedInfo?.type === 'naddr' && decodedInfo.kind && decodedInfo.pubkey && decodedInfo.dTag) {
        // For naddr (addressable events), query by kind + author + d-tag
        filter = {
          kinds: [decodedInfo.kind],
          authors: [decodedInfo.pubkey],
          '#d': [decodedInfo.dTag],
          limit: 1,
        };
      } else {
        // For regular events (hex, note, nevent), query by ID
        const eventId = decodedInfo?.id || identifier;
        filter = {
          kinds: [21, 34235, 22, 34236], // All video kinds (horizontal and vertical, new and legacy)
          ids: [eventId],
        };
      }

      const events = await nostr.query(
        [filter],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) }
      );

      if (events.length === 0) {
        throw new Error('Video not found');
      }

      const rawEvent = events[0];
      const parsedVideo = parseVideoEvent(rawEvent);

      if (!parsedVideo) {
        throw new Error('Failed to parse video event');
      }

      return {
        event: rawEvent,
        video: parsedVideo,
      };
    },
    enabled: !!identifier,
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Hook to fetch videos by a specific author
 */
export function useChannelVideos(pubkey: string, limit = 50) {
  return useVideos({ authors: [pubkey], limit });
}

/**
 * Hook to search videos
 */
export function useSearchVideos(query: string, limit = 50) {
  return useVideos({ search: query, limit });
}

/**
 * Hook for infinite scroll video feed
 * Loads videos in pages with cursor-based pagination
 */
export function useInfiniteVideos(options: Omit<UseVideosOptions, 'limit'> & { pageSize?: number } = {}) {
  const { nostr } = useNostr();
  const { pageSize = 20, authors, hashtags, search, kinds } = options;

  return useInfiniteQuery({
    queryKey: ['videos-infinite', { authors, hashtags, search, kinds }],
    queryFn: async ({ signal, pageParam }) => {
      try {
        const filter: any = {
          kinds: kinds || [21, 34235], // Default to horizontal videos (new and legacy)
          limit: pageSize,
        };

        if (authors && authors.length > 0) {
          filter.authors = authors;
        }

        if (hashtags && hashtags.length > 0) {
          filter['#t'] = hashtags;
        }

        if (search) {
          filter.search = search;
        }

        // Use cursor for pagination (until timestamp)
        if (pageParam) {
          filter.until = pageParam;
        }

        const events = await nostr.query(
          [filter],
          { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) }
        );

        // Parse and deduplicate events
        const videoEvents: VideoEvent[] = [];
        const seenIds = new Set<string>();

        for (const event of events) {
          if (seenIds.has(event.id)) continue;
          seenIds.add(event.id);

          const videoEvent = parseVideoEvent(event);
          if (videoEvent) {
            videoEvents.push(videoEvent);
          }
        }

        // Sort by published_at or created_at
        videoEvents.sort((a, b) => {
          const aTime = a.publishedAt || a.created_at;
          const bTime = b.publishedAt || b.created_at;
          return bTime - aTime;
        });

        // Get the oldest timestamp for the next cursor, minus 1 to avoid duplicates
        const oldestTimestamp = videoEvents.length > 0
          ? Math.min(...videoEvents.map(v => v.publishedAt || v.created_at)) - 1
          : undefined;

        return {
          videos: videoEvents,
          nextCursor: videoEvents.length === pageSize ? oldestTimestamp : undefined,
        };
      } catch (error) {
        console.error('Error fetching videos:', error);
        return { videos: [], nextCursor: undefined };
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as number | undefined,
    staleTime: 60000, // 1 minute
  });
}
