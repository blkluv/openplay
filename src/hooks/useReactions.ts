import { NKinds, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';

/**
 * Hook to fetch reactions (likes) for a specific event
 * Reactions in Nostr are kind 7 events with "+" content for likes
 */
export function useReactions(target: NostrEvent | null | undefined) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['nostr', 'reactions', target?.id, user?.pubkey],
    queryFn: async (c) => {
      if (!target) {
        return { count: 0, hasLiked: false, reactions: [] };
      }

      const filter: NostrFilter = { kinds: [7] };

      // Add the appropriate tag based on event type
      if (NKinds.addressable(target.kind)) {
        const d = target.tags.find(([name]) => name === 'd')?.[1] ?? '';
        filter['#a'] = [`${target.kind}:${target.pubkey}:${d}`];
      } else if (NKinds.replaceable(target.kind)) {
        filter['#a'] = [`${target.kind}:${target.pubkey}:`];
      } else {
        filter['#e'] = [target.id];
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([filter], { signal });

      // Filter for likes (content === "+")
      const likes = events.filter(event => event.content === '+');

      // Check if current user has liked
      const hasLiked = user ? likes.some(like => like.pubkey === user.pubkey) : false;

      return {
        count: likes.length,
        hasLiked,
        reactions: likes,
      };
    },
    enabled: !!target,
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
