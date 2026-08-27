import { useParams, Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { VideoLayout } from '@/components/video/VideoLayout';
import { VideoCard } from '@/components/video/VideoCard';
import { useInfiniteVideos } from '@/hooks/useVideos';
import { usePlaylists } from '@/hooks/usePlaylists';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { AlertCircle, User, Video as VideoIcon, Calendar, MapPin, ListVideo, ChevronDown, ChevronRight } from 'lucide-react';
import { formatRelativeTime } from '@/lib/videoUtils';
import { nip19 } from 'nostr-tools';
import { useMemo, useState } from 'react';
import { hexToNpub } from '@/lib/nostrUtils';
import { useToast } from '@/hooks/useToast';
import { ZapDialog } from '@/components/ZapDialog';
import { useIsFollowing, useFollowMutation } from '@/hooks/useContacts';

export default function VideoChannel() {
  const { pubkey: pubkeyParam } = useParams<{ pubkey: string }>();
  const { user: currentUser } = useCurrentUser();
  const { toast } = useToast();

  // Decode npub to hex if needed
  const pubkey = useMemo(() => {
    if (!pubkeyParam) return undefined;

    // If it starts with npub, decode it
    if (pubkeyParam.startsWith('npub')) {
      try {
        const decoded = nip19.decode(pubkeyParam);
        if (decoded.type === 'npub') {
          return decoded.data as string;
        }
      } catch (error) {
        console.error('Failed to decode npub:', error);
        return undefined;
      }
    }

    // Otherwise assume it's already hex
    return pubkeyParam;
  }, [pubkeyParam]);

  const { data: author, isLoading: authorLoading } = useAuthor(pubkey);
  const isOwnChannel = currentUser?.pubkey === pubkey;
  const isFollowing = useIsFollowing(pubkey);
  const followMutation = useFollowMutation();

  useSeoMeta({
    title: author?.metadata?.name ? `${author.metadata.name}'s Channel - VID` : 'Channel - VID',
    description: author?.metadata?.about || 'View channel on VID',
  });

  // Fetch horizontal videos
  const {
    data: videosData,
    isLoading: videosLoading,
    error: videosError,
    fetchNextPage: fetchNextVideosPage,
    hasNextPage: hasNextVideosPage,
    isFetchingNextPage: isFetchingNextVideosPage,
  } = useInfiniteVideos({
    pageSize: 50,
    kinds: [21, 34235],
    authors: pubkey ? [pubkey] : undefined,
  });

  // Fetch shorts
  const {
    data: shortsData,
    isLoading: shortsLoading,
    fetchNextPage: fetchNextShortsPage,
    hasNextPage: hasNextShortsPage,
    isFetchingNextPage: isFetchingNextShortsPage,
  } = useInfiniteVideos({
    pageSize: 50,
    kinds: [22, 34236],
    authors: pubkey ? [pubkey] : undefined,
  });

  // Flatten and deduplicate videos
  const videos = videosData?.pages.flatMap((page) => page.videos) ?? [];
  const uniqueVideos = videos.reduce((acc, video) => {
    if (!acc.find(v => v.id === video.id)) {
      acc.push(video);
    }
    return acc;
  }, [] as typeof videos);

  // Flatten and deduplicate shorts
  const shorts = shortsData?.pages.flatMap((page) => page.videos) ?? [];
  const uniqueShorts = shorts.reduce((acc, video) => {
    if (!acc.find(v => v.id === video.id)) {
      acc.push(video);
    }
    return acc;
  }, [] as typeof shorts);

  // Fetch playlists
  const { data: playlists, isLoading: playlistsLoading } = usePlaylists(pubkey);

  // State for collapsible sections
  const [shortsExpanded, setShortsExpanded] = useState(true);
  const [videosExpanded, setVideosExpanded] = useState(true);
  const [showAllShorts, setShowAllShorts] = useState(false);
  const [showAllVideos, setShowAllVideos] = useState(false);

  // Display limits
  const INITIAL_SHORTS_LIMIT = 8; // 4 on desktop, 2x4 on mobile
  const INITIAL_VIDEOS_LIMIT = 6; // 3 on desktop, 2x3 on mobile

  // Compute displayed items
  const displayedShorts = showAllShorts ? uniqueShorts : uniqueShorts.slice(0, INITIAL_SHORTS_LIMIT);
  const displayedVideos = showAllVideos ? uniqueVideos : uniqueVideos.slice(0, INITIAL_VIDEOS_LIMIT);

  const isLoading = videosLoading || shortsLoading;
  const error = videosError;
  const videoCount = uniqueVideos.length + uniqueShorts.length;

  const handleSubscribeClick = () => {
    if (!pubkey) return;

    followMutation.mutate({
      pubkey,
      action: isFollowing ? 'unfollow' : 'follow',
    });
  };

  return (
    <VideoLayout>
      <div className="pb-6">
        {/* Channel Banner */}
        {author?.metadata?.banner && (
          <div className="w-full h-32 sm:h-48 md:h-64 bg-muted overflow-hidden">
            <img
              src={author.metadata.banner}
              alt="Channel banner"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Channel Header */}
        <div className="container px-4 mt-6">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <Avatar className="h-24 w-24 sm:h-32 sm:w-32 ring-4 ring-background">
              <AvatarImage src={author?.metadata?.picture} />
              <AvatarFallback>
                <User className="h-12 w-12 sm:h-16 sm:w-16" />
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-3xl font-bold">
                  {authorLoading ? 'Loading...' : (author?.metadata?.name || author?.metadata?.display_name || 'Anonymous')}
                </h1>
                {author?.metadata?.nip05 && (
                  <p className="text-muted-foreground">@{author.metadata.nip05}</p>
                )}
                {pubkey && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(hexToNpub(pubkey));
                      toast({
                        title: 'Copied!',
                        description: 'Public key copied to clipboard',
                      });
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground font-mono transition-colors mt-1"
                    title="Click to copy npub"
                  >
                    {hexToNpub(pubkey).slice(0, 16)}...{hexToNpub(pubkey).slice(-8)}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <VideoIcon className="h-4 w-4" />
                  <span>{videoCount} videos</span>
                </div>
                {author?.metadata?.lud16 && author?.event && (
                  <ZapDialog target={author.event}>
                    <button
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      title="Click to zap"
                    >
                      <span className="text-yellow-500">⚡</span>
                      <span className="font-mono text-xs">{author.metadata.lud16}</span>
                    </button>
                  </ZapDialog>
                )}
              </div>

              {!isOwnChannel && currentUser && (
                <Button
                  onClick={handleSubscribeClick}
                  disabled={followMutation.isPending}
                  variant={isFollowing ? 'outline' : 'default'}
                >
                  {followMutation.isPending ? 'Loading...' : isFollowing ? 'Unsubscribe' : 'Subscribe'}
                </Button>
              )}
            </div>
          </div>

          {/* Channel Tabs */}
          <Tabs defaultValue="videos" className="w-full mt-6">
          <TabsList>
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="playlists">
              Playlists
              {playlists && playlists.length > 0 && (
                <span className="ml-1.5 text-xs opacity-60">({playlists.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="videos" className="mt-6">
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load videos. Please try again later.
                </AlertDescription>
              </Alert>
            )}

            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-video rounded-lg" />
                    <div className="flex gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && uniqueVideos.length === 0 && uniqueShorts.length === 0 && (
              <div className="text-center py-12">
                <VideoIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {isOwnChannel
                    ? "You haven't uploaded any videos yet"
                    : "This channel hasn't uploaded any videos yet"}
                </p>
                {isOwnChannel && (
                  <Button className="mt-4" asChild>
                    <a href="/upload">Upload Your First Video</a>
                  </Button>
                )}
              </div>
            )}

            {!isLoading && (uniqueVideos.length > 0 || uniqueShorts.length > 0) && (
              <div className="space-y-6">
                {/* Shorts Section */}
                {uniqueShorts.length > 0 && (
                  <section className="pb-6 border-b">
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => setShortsExpanded(!shortsExpanded)}
                        className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      >
                        {shortsExpanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                        <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                          <span className="text-xl sm:text-2xl">📱</span>
                          <span className="text-base sm:text-xl">Shorts</span>
                          <span className="text-sm text-muted-foreground">({uniqueShorts.length})</span>
                        </h2>
                      </button>
                    </div>

                    {shortsExpanded && (
                      <>
                        {/* Mobile: 2 column grid */}
                        <div className="lg:hidden grid grid-cols-2 gap-3">
                          {displayedShorts.map((video) => (
                            <VideoCard key={video.id} video={video} layout="vertical" channelContext={pubkey} />
                          ))}
                        </div>
                        {/* Desktop: 4 column grid */}
                        <div className="hidden lg:grid lg:grid-cols-4 gap-4">
                          {displayedShorts.map((video) => (
                            <VideoCard key={video.id} video={video} layout="vertical" channelContext={pubkey} />
                          ))}
                        </div>

                        {/* View All Button */}
                        {!showAllShorts && uniqueShorts.length > INITIAL_SHORTS_LIMIT && (
                          <div className="mt-4 text-center">
                            <Button
                              variant="outline"
                              onClick={() => setShowAllShorts(true)}
                            >
                              View All ({uniqueShorts.length} shorts)
                            </Button>
                          </div>
                        )}
                        {showAllShorts && uniqueShorts.length > INITIAL_SHORTS_LIMIT && (
                          <div className="mt-4 text-center">
                            <Button
                              variant="ghost"
                              onClick={() => setShowAllShorts(false)}
                            >
                              Show Less
                            </Button>
                          </div>
                        )}

                        {/* Load More from Network Button */}
                        {hasNextShortsPage && (
                          <div className="mt-4 text-center">
                            <Button
                              variant="outline"
                              onClick={() => fetchNextShortsPage()}
                              disabled={isFetchingNextShortsPage}
                            >
                              {isFetchingNextShortsPage ? 'Loading...' : 'Load More Shorts'}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}

                {/* Videos Section */}
                {uniqueVideos.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => setVideosExpanded(!videosExpanded)}
                        className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      >
                        {videosExpanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                        <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                          <span>Videos</span>
                          <span className="text-sm text-muted-foreground">({uniqueVideos.length})</span>
                        </h2>
                      </button>
                    </div>

                    {videosExpanded && (
                      <>
                        {/* Mobile: Single column */}
                        <div className="lg:hidden space-y-4 w-full max-w-full overflow-hidden">
                          {displayedVideos.map((video) => (
                            <div key={video.id} className="w-full max-w-full box-border">
                              <VideoCard video={video} layout="grid" />
                            </div>
                          ))}
                        </div>
                        {/* Desktop: 3 column grid */}
                        <div className="hidden lg:grid lg:grid-cols-3 gap-4">
                          {displayedVideos.map((video) => (
                            <VideoCard key={video.id} video={video} />
                          ))}
                        </div>

                        {/* View All Button */}
                        {!showAllVideos && uniqueVideos.length > INITIAL_VIDEOS_LIMIT && (
                          <div className="mt-4 text-center">
                            <Button
                              variant="outline"
                              onClick={() => setShowAllVideos(true)}
                            >
                              View All ({uniqueVideos.length} videos)
                            </Button>
                          </div>
                        )}
                        {showAllVideos && uniqueVideos.length > INITIAL_VIDEOS_LIMIT && (
                          <div className="mt-4 text-center">
                            <Button
                              variant="ghost"
                              onClick={() => setShowAllVideos(false)}
                            >
                              Show Less
                            </Button>
                          </div>
                        )}

                        {/* Load More from Network Button */}
                        {hasNextVideosPage && (
                          <div className="mt-4 text-center">
                            <Button
                              variant="outline"
                              onClick={() => fetchNextVideosPage()}
                              disabled={isFetchingNextVideosPage}
                            >
                              {isFetchingNextVideosPage ? 'Loading...' : 'Load More Videos'}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="playlists" className="mt-6">
            {playlistsLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="p-4 space-y-3">
                    <Skeleton className="aspect-video rounded-lg" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </Card>
                ))}
              </div>
            )}

            {!playlistsLoading && (!playlists || playlists.length === 0) && (
              <div className="text-center py-12">
                <ListVideo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {isOwnChannel
                    ? "You haven't created any playlists yet"
                    : "This channel hasn't created any playlists yet"}
                </p>
              </div>
            )}

            {!playlistsLoading && playlists && playlists.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {playlists.map((playlist) => (
                  <Link
                    key={playlist.id}
                    to={`/playlist/${hexToNpub(playlist.pubkey)}/${playlist.d}`}
                    className="group"
                  >
                    <Card className="overflow-hidden transition-all duration-200 hover:shadow-xl hover:shadow-primary/20 hover:-translate-y-1">
                      <div className="relative aspect-video bg-muted">
                        {playlist.image ? (
                          <img
                            src={playlist.image}
                            alt={playlist.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ListVideo className="h-16 w-16 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-between p-3">
                          <div className="flex items-center gap-1 text-white text-sm">
                            <ListVideo className="h-4 w-4" />
                            <span>{playlist.videoIds.length}</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold line-clamp-2 group-hover:text-primary">
                          {playlist.title}
                        </h3>
                        {playlist.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {playlist.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatRelativeTime(playlist.created_at)}
                        </p>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="about" className="mt-6">
            <div className="max-w-2xl space-y-6">
              {author?.metadata?.about && (
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-sm whitespace-pre-wrap">{author.metadata.about}</p>
                </div>
              )}

              {author?.metadata?.website && (
                <div>
                  <h3 className="font-semibold mb-2">Website</h3>
                  <a
                    href={author.metadata.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {author.metadata.website}
                  </a>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Videos</span>
                    <span className="font-medium">{videoCount}</span>
                  </div>
                  {/* TODO: Add more stats */}
                </div>
              </div>
            </div>
          </TabsContent>
          </Tabs>
        </div>
      </div>
    </VideoLayout>
  );
}
