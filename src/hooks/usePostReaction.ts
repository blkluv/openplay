import { NKinds, NostrEvent } from '@nostrify/nostrify';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';

/**
 * Hook to post a reaction (like) to an event
 * Posts a kind 7 event with "+" content for likes
 */
export function usePostReaction() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ target, content = '+' }: { target: NostrEvent; content?: string }) => {
      if (!user) {
        throw new Error('User must be logged in to react');
      }

      const tags: string[][] = [];

      // Add the appropriate tag based on event type
      if (NKinds.addressable(target.kind)) {
        const d = target.tags.find(([name]) => name === 'd')?.[1] ?? '';
        tags.push(['a', `${target.kind}:${target.pubkey}:${d}`]);
        tags.push(['e', target.id]);
      } else if (NKinds.replaceable(target.kind)) {
        tags.push(['a', `${target.kind}:${target.pubkey}:`]);
        tags.push(['e', target.id]);
      } else {
        tags.push(['e', target.id]);
      }

      // Add p tag for the author
      tags.push(['p', target.pubkey]);

      // Add k tag for the kind
      tags.push(['k', target.kind.toString()]);

      const event = await publishEvent({
        kind: 7,
        content,
        tags,
      });

      return event;
    },
    onSuccess: (_, variables) => {
      // Invalidate reactions query to refetch
      queryClient.invalidateQueries({
        queryKey: ['nostr', 'reactions', variables.target.id],
      });
    },
    onError: (error) => {
      console.error('Failed to post reaction:', error);
    },
  });
}
