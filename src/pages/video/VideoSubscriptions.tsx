import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import { VideoLayout } from '@/components/video/VideoLayout';
import { VideoCard } from '@/components/video/VideoCard';
import { useInfiniteVideos } from '@/hooks/useVideos';
import { useContacts } from '@/hooks/useContacts';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Users, ChevronRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

export default function VideoSubscriptions() {
  const { user: currentUser } = useCurrentUser();

  useSeoMeta({
    title: 'Subscriptions - OpenPlay',
    description: 'Watch videos from people you follow on the decentralized Nostr network',
  });

  // Get the list of people the current user follows
  const { data: contactsData, isLoading: isLoadingContacts } = useContacts(currentUser?.pubkey);
  const following = contactsData?.contacts.map(c => c.pubkey) || [];

  // Fetch both horizontal videos and shorts from followed users
  const {
    data: videosData,
    isLoading: videosLoading,
    error: videosError,
    fetchNextPage: fetchNextVideos,
    hasNextPage: hasNextVideos,
    isFetchingNextPage: isFetchingNextVideos,
  } = useInfiniteVideos({
    pageSize: 12,
    kinds: [21, 34235], // Horizontal videos
    authors: following.length > 0 ? following : undefined,
  });

  const {
    data: shortsData,
    isLoading: shortsLoading,
  } = useInfiniteVideos({
    pageSize: 8,
    kinds: [22, 34236], // Vertical shorts
    authors: following.length > 0 ? following : undefined,
  });

  const isLoading = videosLoading || shortsLoading;
  const error = videosError;

  const observerTarget = useRef<HTMLDivElement>(null);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextVideos && !isFetchingNextVideos) {
          fetchNextVideos();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNextVideos, isFetchingNextVideos, fetchNextVideos]);

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

  if (!currentUser) {
    return (
      <VideoLayout>
        <div className="container py-12 px-4">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <Users className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Sign In to View Subscriptions</h2>
            <p className="text-muted-foreground">
              Sign in to see videos from people you follow
            </p>
          </div>
        </div>
      </VideoLayout>
    );
  }

  return (
    <VideoLayout>
      <div className="w-full max-w-full pt-1 pb-2 sm:pt-1 sm:pb-3 px-3 sm:px-4 space-y-4 sm:space-y-6 lg:max-w-7xl mx-auto box-border overflow-x-hidden">
        {error && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Unable to connect to relays. Check your internet connection and try again.
            </AlertDescription>
          </Alert>
        )}

        {(isLoading || isLoadingContacts) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

        {!isLoading && !isLoadingContacts && !error && following.length === 0 && (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto space-y-4">
              <Users className="h-16 w-16 mx-auto text-muted-foreground" />
              <h2 className="text-xl font-semibold">No Subscriptions Yet</h2>
              <p className="text-muted-foreground">
                Start following creators to see their videos here. Visit channel pages and click Subscribe to follow your favorite creators.
              </p>
            </div>
          </div>
        )}

        {!isLoading && !isLoadingContacts && !error && following.length > 0 && uniqueVideos.length === 0 && (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto space-y-4">
              <div className="text-6xl">📹</div>
              <h2 className="text-xl font-semibold">No Videos From Subscriptions</h2>
              <p className="text-muted-foreground">
                The people you follow haven't posted any videos yet. Check back later for new content!
              </p>
            </div>
          </div>
        )}

        {!isLoading && !isLoadingContacts && (uniqueVideos.length > 0 || uniqueShorts.length > 0) && (
          <>
            {/* Shorts Section */}
            {uniqueShorts.length > 0 && (
              <section className="pb-4 sm:pb-6 border-b">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                    <span className="text-xl sm:text-2xl">📱</span>
                    <span className="text-base sm:text-xl">Shorts</span>
                  </h2>
                  <Button variant="ghost" size="sm" asChild className="text-xs sm:text-sm h-8 sm:h-9">
                    <Link to="/shorts" className="flex items-center gap-1">
                      View all
                      <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Link>
                  </Button>
                </div>
                {/* Mobile: 2 column grid */}
                <div className="lg:hidden grid grid-cols-2 gap-3">
                  {uniqueShorts.slice(0, 4).map((video) => (
                    <VideoCard key={video.id} video={video} layout="vertical" />
                  ))}
                </div>
                {/* Desktop: 4 column grid */}
                <div className="hidden lg:grid lg:grid-cols-4 gap-4">
                  {uniqueShorts.slice(0, 4).map((video) => (
                    <VideoCard key={video.id} video={video} layout="vertical" />
                  ))}
                </div>
              </section>
            )}

            {/* Videos Section */}
            {uniqueVideos.length > 0 && (
              <section className="pt-2">
                <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Videos</h2>
                {/* Mobile: Single column */}
                <div className="lg:hidden space-y-4 w-full max-w-full overflow-hidden">
                  {uniqueVideos.map((video) => (
                    <div key={video.id} className="w-full max-w-full box-border">
                      <VideoCard video={video} layout="grid" />
                    </div>
                  ))}
                </div>
                {/* Desktop: Multi-column grid */}
                <div className="hidden lg:grid lg:grid-cols-3 gap-4">
                  {uniqueVideos.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>

                {/* Infinite scroll trigger */}
                <div ref={observerTarget} className="flex justify-center py-6 sm:py-8">
                  {isFetchingNextVideos && (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm sm:text-base">
                      <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                      <span>Loading more videos...</span>
                    </div>
                  )}
                  {!isFetchingNextVideos && hasNextVideos && (
                    <Button
                      variant="outline"
                      onClick={() => fetchNextVideos()}
                      className="text-sm sm:text-base h-9 sm:h-10"
                    >
                      Load More
                    </Button>
                  )}
                  {!hasNextVideos && uniqueVideos.length > 0 && (
                    <p className="text-muted-foreground text-xs sm:text-sm">You've reached the end</p>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </VideoLayout>
  );
}
