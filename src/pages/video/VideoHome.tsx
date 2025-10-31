import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import { VideoLayout } from '@/components/video/VideoLayout';
import { VideoCard } from '@/components/video/VideoCard';
import { useInfiniteVideos } from '@/hooks/useVideos';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const categories = [
  'All',
  'Bitcoin',
  'Nostr',
  'Technology',
  'Music',
  'Gaming',
  'Education',
  'News',
  'Comedy',
  'Sports',
];

export default function VideoHome() {
  const [selectedCategory, setSelectedCategory] = useState('All');

  useSeoMeta({
    title: 'OpenPlay - Decentralized Video Platform',
    description: 'Discover and watch videos on the decentralized Nostr network',
  });

  // Fetch horizontal videos
  const {
    data: videosData,
    isLoading: videosLoading,
    error: videosError,
    fetchNextPage: fetchNextVideos,
    hasNextPage: hasNextVideos,
    isFetchingNextPage: isFetchingNextVideos,
  } = useInfiniteVideos({
    pageSize: 12,
    kinds: [21, 34235],
    hashtags: selectedCategory === 'All' ? undefined : [selectedCategory.toLowerCase()],
  });

  // Fetch shorts with infinite scroll
  const {
    data: shortsData,
    isLoading: shortsLoading,
    fetchNextPage: fetchNextShorts,
    hasNextPage: hasNextShorts,
    isFetchingNextPage: isFetchingNextShorts,
  } = useInfiniteVideos({
    pageSize: 8,
    kinds: [22, 34236],
  });

  const observerTarget = useRef<HTMLDivElement>(null);

  // Intersection Observer for infinite scroll - fetch both types
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Fetch more videos if available
          if (hasNextVideos && !isFetchingNextVideos) {
            fetchNextVideos();
          }
          // Fetch more shorts if available
          if (hasNextShorts && !isFetchingNextShorts) {
            fetchNextShorts();
          }
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
  }, [hasNextVideos, isFetchingNextVideos, fetchNextVideos, hasNextShorts, isFetchingNextShorts, fetchNextShorts]);

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

  // Create interleaved content: alternate between video rows and short rows
  const videosPerRow = 3;
  const shortsPerRow = 4;
  const videoRows = [];
  const shortRows = [];

  // Split videos into rows
  for (let i = 0; i < uniqueVideos.length; i += videosPerRow) {
    videoRows.push(uniqueVideos.slice(i, i + videosPerRow));
  }

  // Split shorts into rows
  for (let i = 0; i < uniqueShorts.length; i += shortsPerRow) {
    shortRows.push(uniqueShorts.slice(i, i + shortsPerRow));
  }

  // Interleave: start with videos, then shorts, alternating
  const interleavedContent: Array<{ type: 'videos' | 'shorts', items: typeof uniqueVideos | typeof uniqueShorts }> = [];
  const maxRows = Math.max(videoRows.length, shortRows.length);

  for (let i = 0; i < maxRows; i++) {
    if (videoRows[i]) {
      interleavedContent.push({ type: 'videos', items: videoRows[i] });
    }
    if (shortRows[i]) {
      interleavedContent.push({ type: 'shorts', items: shortRows[i] });
    }
  }

  // Only show loading if we're loading videos AND we have no content yet
  const isLoading = videosLoading && uniqueVideos.length === 0;

  return (
    <VideoLayout>
      <div className="w-full overflow-x-hidden">
        {/* Category Pills */}
        <div className="sticky top-0 z-40 bg-background border-b">
          <div className="w-full max-w-full px-3 sm:px-4 py-2 lg:max-w-7xl mx-auto box-border overflow-x-hidden">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    "flex-shrink-0 rounded-full text-xs sm:text-sm h-8 px-3",
                    selectedCategory === category ? "" : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full max-w-full pt-1 pb-2 sm:pt-1 sm:pb-3 px-3 sm:px-4 space-y-4 sm:space-y-6 lg:max-w-7xl mx-auto box-border">
          {videosError && (
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Unable to connect to relays. Check your internet connection and try again.
              </AlertDescription>
            </Alert>
          )}

          {isLoading && (
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

          {!isLoading && !videosError && uniqueVideos.length === 0 && (
            <div className="text-center py-12">
              <div className="max-w-md mx-auto space-y-4">
                <div className="text-6xl">📹</div>
                <h2 className="text-xl font-semibold">No Videos Yet</h2>
                <p className="text-muted-foreground">
                  {selectedCategory === 'All'
                    ? 'Be the first to share a video on OpenPlay! Upload your content and help build the decentralized video network.'
                    : `No videos found for ${selectedCategory}. Try selecting a different category.`}
                </p>
              </div>
            </div>
          )}

          {!isLoading && uniqueVideos.length > 0 && (
            <>
              {/* Featured/Hero Video - Mobile Only */}
              {uniqueVideos.length > 0 && (
                <section className="lg:hidden mb-6 w-full max-w-full">
                  <div className="w-full max-w-full">
                    <VideoCard video={uniqueVideos[0]} layout="grid" />
                  </div>
                </section>
              )}

              {/* Interleaved content: alternating videos and shorts */}
              {interleavedContent.map((section, index) => (
                <section
                  key={`${section.type}-${index}`}
                  className={cn(
                    "space-y-4",
                    section.type === 'shorts' ? "py-6 border-y bg-muted/20" : ""
                  )}
                >
                  {section.type === 'videos' ? (
                    <>
                      {/* Mobile: Single column (skip first video as it's featured) */}
                      <div className="lg:hidden space-y-4 w-full max-w-full overflow-hidden">
                        {section.items.slice(index === 0 ? 1 : 0).map((video) => (
                          <div key={video.id} className="w-full max-w-full box-border">
                            <VideoCard video={video} layout="grid" />
                          </div>
                        ))}
                      </div>
                      {/* Desktop: Multi-column grid */}
                      <div className="hidden lg:grid lg:grid-cols-3 gap-4">
                        {section.items.map((video) => (
                          <VideoCard key={video.id} video={video} />
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                          <span className="text-xl sm:text-2xl">📱</span>
                          <span className="text-base sm:text-xl">Shorts</span>
                        </h2>
                        {index === 1 && (
                          <Button variant="ghost" size="sm" asChild className="text-xs sm:text-sm h-8 sm:h-9">
                            <Link to="/shorts" className="flex items-center gap-1">
                              View all
                              <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Link>
                          </Button>
                        )}
                      </div>
                      {/* Mobile: 2 column grid */}
                      <div className="lg:hidden grid grid-cols-2 gap-3">
                        {section.items.map((video) => (
                          <VideoCard key={video.id} video={video} layout="vertical" />
                        ))}
                      </div>
                      {/* Desktop: 4 column grid */}
                      <div className="hidden lg:grid lg:grid-cols-4 gap-4">
                        {section.items.map((video) => (
                          <VideoCard key={video.id} video={video} layout="vertical" />
                        ))}
                      </div>
                    </>
                  )}
                </section>
              ))}

              {/* Infinite scroll trigger */}
              <div ref={observerTarget} className="flex justify-center py-6 sm:py-8">
                {(isFetchingNextVideos || isFetchingNextShorts) && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm sm:text-base">
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                    <span>Loading more content...</span>
                  </div>
                )}
                {!isFetchingNextVideos && !isFetchingNextShorts && (hasNextVideos || hasNextShorts) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (hasNextVideos) fetchNextVideos();
                      if (hasNextShorts) fetchNextShorts();
                    }}
                    className="text-sm sm:text-base h-9 sm:h-10"
                  >
                    Load More
                  </Button>
                )}
                {!hasNextVideos && !hasNextShorts && interleavedContent.length > 0 && (
                  <p className="text-muted-foreground text-xs sm:text-sm">You've reached the end</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </VideoLayout>
  );
}
