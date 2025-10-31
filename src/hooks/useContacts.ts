import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { finalizeEvent, type NostrEvent } from 'nostr-tools';
import { useToast } from './useToast';

interface Contact {
  pubkey: string;
  relay?: string;
  petname?: string;
}

/**
 * Hook to fetch the current user's contact list (kind 3)
 */
export function useContacts(pubkey?: string, options?: { enabled?: boolean }) {
  const { nostr } = useNostr();
  const { user: currentUser } = useCurrentUser();

  // Use provided pubkey or fall back to current user's pubkey
  const targetPubkey = pubkey || currentUser?.pubkey;

  return useQuery({
    queryKey: ['contacts', targetPubkey],
    queryFn: async ({ signal }) => {
      if (!targetPubkey) {
        return { contacts: [], event: null };
      }

      const events = await nostr.query(
        [
          {
            kinds: [3],
            authors: [targetPubkey],
            limit: 1,
          },
        ],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
      );

      if (events.length === 0) {
        return { contacts: [], event: null };
      }

      // Get the most recent event
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

      // Parse contacts from p tags
      const contacts: Contact[] = latestEvent.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => ({
          pubkey: tag[1],
          relay: tag[2],
          petname: tag[3],
        }));

      return { contacts, event: latestEvent };
    },
    enabled: options?.enabled !== undefined ? (options.enabled && !!targetPubkey) : !!targetPubkey,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to check if the current user is following a specific pubkey
 */
export function useIsFollowing(pubkey: string | undefined) {
  const { data } = useContacts();

  if (!pubkey || !data) {
    return false;
  }

  return data.contacts.some(contact => contact.pubkey === pubkey);
}

/**
 * Hook to follow/unfollow users
 */
export function useFollowMutation() {
  const { nostr } = useNostr();
  const { user: currentUser } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pubkey, action }: { pubkey: string; action: 'follow' | 'unfollow' }) => {
      if (!currentUser?.pubkey || !currentUser?.nsec) {
        throw new Error('Not logged in');
      }

      // Fetch current contact list
      const currentData = queryClient.getQueryData<{ contacts: Contact[]; event: NostrEvent | null }>([
        'contacts',
        currentUser.pubkey,
      ]);

      let newContacts: Contact[] = [];

      if (currentData?.contacts) {
        newContacts = [...currentData.contacts];
      }

      if (action === 'follow') {
        // Add the new contact if not already following
        if (!newContacts.some(c => c.pubkey === pubkey)) {
          newContacts.push({ pubkey });
        }
      } else {
        // Remove the contact
        newContacts = newContacts.filter(c => c.pubkey !== pubkey);
      }

      // Build the new kind 3 event
      const tags = newContacts.map(contact => {
        const tag = ['p', contact.pubkey];
        if (contact.relay) tag.push(contact.relay);
        if (contact.petname) tag.push(contact.petname);
        return tag;
      });

      // Preserve content from previous event if it exists
      const content = currentData?.event?.content || '';

      const unsignedEvent = {
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content,
        pubkey: currentUser.pubkey,
      };

      // Sign the event
      const signedEvent = finalizeEvent(unsignedEvent, currentUser.nsec);

      // Publish to all relays using nostr.event()
      await nostr.event(signedEvent);

      return { action, pubkey };
    },
    onSuccess: (data) => {
      // Invalidate and refetch contacts
      queryClient.invalidateQueries({ queryKey: ['contacts', currentUser?.pubkey] });

      toast({
        title: data.action === 'follow' ? 'Subscribed!' : 'Unsubscribed',
        description: data.action === 'follow'
          ? 'You are now following this channel'
          : 'You have unfollowed this channel',
      });
    },
    onError: (error) => {
      console.error('Failed to update contacts:', error);
      toast({
        title: 'Error',
        description: 'Failed to update your contact list. Please try again.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to get follower count for a pubkey
 */
export function useFollowerCount(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['followerCount', pubkey],
    queryFn: async ({ signal }) => {
      if (!pubkey) {
        return 0;
      }

      const events = await nostr.query(
        [
          {
            kinds: [3],
            '#p': [pubkey],
          },
        ],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) }
      );

      // Deduplicate by author (one contact list per user)
      const uniqueFollowers = new Set(events.map(e => e.pubkey));
      return uniqueFollowers.size;
    },
    enabled: !!pubkey,
    staleTime: 5 * 60000, // 5 minutes
  });
}
