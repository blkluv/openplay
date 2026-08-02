import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { finalizeEvent } from 'nostr-tools';

// Updated: added blossom.azzamo.net as the first (free) server
const DEFAULT_SERVERS = [
  'https://blossom.primal.net/',
  'https://blossom.band/',
  'https://cdn.satellite.earth/',
];

export interface MediaServer {
  url: string;
  enabled: boolean;
}

export function useMediaServers() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const queryClient = useQueryClient();

  // Fetch media servers from Nostr (kind 10063)
  const { data: servers = [], isLoading } = useQuery({
    queryKey: ['mediaServers', user?.pubkey],
    queryFn: async () => {
      if (!user?.pubkey) {
        return DEFAULT_SERVERS.map(url => ({ url, enabled: true }));
      }

      try {
        const events = await nostr.query([
          {
            kinds: [10063],
            authors: [user.pubkey],
            limit: 1,
          },
        ]);

        if (events.length === 0) {
          // No event found, return defaults
          return DEFAULT_SERVERS.map(url => ({ url, enabled: true }));
        }

        const event = events[0];
        const serverList: MediaServer[] = [];

        // Parse 'server' tags
        for (const tag of event.tags) {
          if (tag[0] === 'server') {
            const url = tag[1];
            const enabled = tag[2] !== 'disabled';
            serverList.push({ url, enabled });
          }
        }

        return serverList.length > 0
          ? serverList
          : DEFAULT_SERVERS.map(url => ({ url, enabled: true }));
      } catch (error) {
        console.error('Failed to fetch media servers:', error);
        return DEFAULT_SERVERS.map(url => ({ url, enabled: true }));
      }
    },
    enabled: true,
    staleTime: 60000, // 1 minute
  });

  // Mutation to save servers to Nostr
  const saveServersMutation = useMutation({
    mutationFn: async (newServers: MediaServer[]) => {
      if (!user?.nsec) {
        throw new Error('User must be logged in to save settings');
      }

      const tags = newServers.map(server => [
        'server',
        server.url,
        server.enabled ? 'enabled' : 'disabled',
      ]);

      const unsignedEvent = {
        kind: 10063,
        pubkey: user.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: '',
      };

      const signedEvent = finalizeEvent(unsignedEvent, user.nsec);
      await nostr.event(signedEvent);

      return newServers;
    },
    onSuccess: (newServers) => {
      queryClient.setQueryData(['mediaServers', user?.pubkey], newServers);
    },
  });

  const saveServers = async (newServers: MediaServer[]) => {
    await saveServersMutation.mutateAsync(newServers);
  };

  const addServer = async (url: string) => {
    // Ensure URL ends with /
    const normalizedUrl = url.endsWith('/') ? url : `${url}/`;

    // Check if server already exists
    if (servers.some(s => s.url === normalizedUrl)) {
      throw new Error('Server already exists');
    }

    const newServers = [...servers, { url: normalizedUrl, enabled: true }];
    await saveServers(newServers);
  };

  const removeServer = async (url: string) => {
    const newServers = servers.filter(s => s.url !== url);
    await saveServers(newServers);
  };

  const toggleServer = async (url: string) => {
    const newServers = servers.map(s =>
      s.url === url ? { ...s, enabled: !s.enabled } : s
    );
    await saveServers(newServers);
  };

  const getEnabledServers = () => {
    const enabled = servers.filter(s => s.enabled).map(s => s.url);
    // If no servers are enabled, return defaults
    return enabled.length > 0 ? enabled : DEFAULT_SERVERS;
  };

  const resetToDefaults = async () => {
    const defaultServersList = DEFAULT_SERVERS.map(url => ({
      url,
      enabled: true,
    }));
    await saveServers(defaultServersList);
  };

  return {
    servers,
    isLoading,
    isSaving: saveServersMutation.isPending,
    addServer,
    removeServer,
    toggleServer,
    getEnabledServers,
    resetToDefaults,
  };
}