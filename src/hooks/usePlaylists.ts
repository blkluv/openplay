import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { finalizeEvent, type NostrEvent } from 'nostr-tools';

export interface Playlist {
  id: string;
  pubkey: string;
  d: string; // unique identifier
  title: string;
  description?: string;
  image?: string;
  videoIds: string[]; // event IDs of videos in the playlist
  created_at: number;
  event: NostrEvent;
}

/**
 * Parse a NIP-51 playlist event (kind 30005)
 */
function parsePlaylistEvent(event: NostrEvent): Playlist | null {
  if (event.kind !== 30005) return null;

  const dTag = event.tags.find(t => t[0] === 'd')?.[1];
  if (!dTag) return null;

  const title = event.tags.find(t => t[0] === 'title')?.[1] || 'Untitled Playlist';
  const description = event.tags.find(t => t[0] === 'description')?.[1];
  const image = event.tags.find(t => t[0] === 'image')?.[1];

  // Extract video event IDs from 'e' tags
  const videoIds = event.tags
    .filter(t => t[0] === 'e')
    .map(t => t[1])
    .filter(Boolean);

  return {
    id: event.id,
    pubkey: event.pubkey,
    d: dTag,
    title,
    description,
    image,
    videoIds,
    created_at: event.created_at,
    event,
  };
}

/**
 * Hook to fetch playlists for a specific user
 */
export function usePlaylists(pubkey?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['playlists', pubkey],
    queryFn: async ({ signal }) => {
      if (!pubkey) return [];

      const events = await nostr.query(
        [
          {
            kinds: [30005], // Video curation sets
            authors: [pubkey],
          },
        ],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) }
      );

      const playlists: Playlist[] = [];
      const seenDTags = new Set<string>();

      // Process events and deduplicate by d tag (keep most recent)
      const sortedEvents = [...events].sort((a, b) => b.created_at - a.created_at);

      for (const event of sortedEvents) {
        const playlist = parsePlaylistEvent(event);
        if (playlist && !seenDTags.has(playlist.d)) {
          seenDTags.add(playlist.d);
          playlists.push(playlist);
        }
      }

      // Sort by creation time, newest first
      return playlists.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!pubkey,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to fetch a single playlist by pubkey and d tag
 */
export function usePlaylist(pubkey: string, dTag: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['playlist', pubkey, dTag],
    queryFn: async ({ signal }) => {
      const events = await nostr.query(
        [
          {
            kinds: [30005],
            authors: [pubkey],
            '#d': [dTag],
          },
        ],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) }
      );

      if (events.length === 0) return null;

      // Get the most recent event
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
      return parsePlaylistEvent(latestEvent);
    },
    enabled: !!pubkey && !!dTag,
    staleTime: 60000,
  });
}

/**
 * Hook to create or update a playlist
 */
export function useCreatePlaylistMutation() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dTag,
      title,
      description,
      image,
      videoIds,
    }: {
      dTag: string;
      title: string;
      description?: string;
      image?: string;
      videoIds: string[];
    }) => {
      if (!user?.nsec) throw new Error('Must be logged in to create a playlist');

      const tags: string[][] = [
        ['d', dTag],
        ['title', title],
      ];

      if (description) {
        tags.push(['description', description]);
      }

      if (image) {
        tags.push(['image', image]);
      }

      // Add video references
      for (const videoId of videoIds) {
        tags.push(['e', videoId]);
      }

      const unsignedEvent = {
        kind: 30005,
        pubkey: user.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: '',
      };

      // Sign the event
      const signedEvent = finalizeEvent(unsignedEvent, user.nsec);

      await nostr.event(signedEvent);
      return signedEvent;
    },
    onSuccess: () => {
      // Invalidate playlists query to refetch
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['playlists', user.pubkey] });
      }
    },
  });
}

/**
 * Hook to add a video to an existing playlist
 */
export function useAddToPlaylistMutation() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      playlist,
      videoId,
    }: {
      playlist: Playlist;
      videoId: string;
    }) => {
      if (!user?.nsec) throw new Error('Must be logged in to modify a playlist');
      if (playlist.pubkey !== user.pubkey) throw new Error('Can only modify your own playlists');

      // Check if video is already in the playlist
      if (playlist.videoIds.includes(videoId)) {
        throw new Error('Video is already in this playlist');
      }

      // Create updated playlist with new video appended
      const updatedVideoIds = [...playlist.videoIds, videoId];

      const tags: string[][] = [
        ['d', playlist.d],
        ['title', playlist.title],
      ];

      if (playlist.description) {
        tags.push(['description', playlist.description]);
      }

      if (playlist.image) {
        tags.push(['image', playlist.image]);
      }

      // Add all video references
      for (const id of updatedVideoIds) {
        tags.push(['e', id]);
      }

      const unsignedEvent = {
        kind: 30005,
        pubkey: user.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: '',
      };

      // Sign the event
      const signedEvent = finalizeEvent(unsignedEvent, user.nsec);

      await nostr.event(signedEvent);
      return signedEvent;
    },
    onSuccess: (_, variables) => {
      // Invalidate queries
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['playlists', user.pubkey] });
        queryClient.invalidateQueries({ queryKey: ['playlist', user.pubkey, variables.playlist.d] });
      }
    },
  });
}

/**
 * Hook to remove a video from a playlist
 */
export function useRemoveFromPlaylistMutation() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      playlist,
      videoId,
    }: {
      playlist: Playlist;
      videoId: string;
    }) => {
      if (!user?.nsec) throw new Error('Must be logged in to modify a playlist');
      if (playlist.pubkey !== user.pubkey) throw new Error('Can only modify your own playlists');

      // Create updated playlist with video removed
      const updatedVideoIds = playlist.videoIds.filter(id => id !== videoId);

      const tags: string[][] = [
        ['d', playlist.d],
        ['title', playlist.title],
      ];

      if (playlist.description) {
        tags.push(['description', playlist.description]);
      }

      if (playlist.image) {
        tags.push(['image', playlist.image]);
      }

      // Add remaining video references
      for (const id of updatedVideoIds) {
        tags.push(['e', id]);
      }

      const unsignedEvent = {
        kind: 30005,
        pubkey: user.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: '',
      };

      // Sign the event
      const signedEvent = finalizeEvent(unsignedEvent, user.nsec);

      await nostr.event(signedEvent);
      return signedEvent;
    },
    onSuccess: (_, variables) => {
      // Invalidate queries
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['playlists', user.pubkey] });
        queryClient.invalidateQueries({ queryKey: ['playlist', user.pubkey, variables.playlist.d] });
      }
    },
  });
}

/**
 * Hook to delete a playlist
 */
export function useDeletePlaylistMutation() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (playlist: Playlist) => {
      if (!user?.nsec) throw new Error('Must be logged in to delete a playlist');
      if (playlist.pubkey !== user.pubkey) throw new Error('Can only delete your own playlists');

      // Create an empty playlist event to effectively delete it
      const tags: string[][] = [
        ['d', playlist.d],
        ['title', playlist.title],
      ];

      if (playlist.description) {
        tags.push(['description', playlist.description]);
      }

      if (playlist.image) {
        tags.push(['image', playlist.image]);
      }

      // No video references = empty playlist

      const unsignedEvent = {
        kind: 30005,
        pubkey: user.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: '',
      };

      // Sign the event
      const signedEvent = finalizeEvent(unsignedEvent, user.nsec);

      await nostr.event(signedEvent);
      return signedEvent;
    },
    onSuccess: () => {
      // Invalidate playlists query
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['playlists', user.pubkey] });
      }
    },
  });
}
