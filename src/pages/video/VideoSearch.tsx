import { useSearchParams } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { VideoLayout } from '@/components/video/VideoLayout';
import { VideoCard } from '@/components/video/VideoCard';
import { useSearchVideos } from '@/hooks/useVideos';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Search as SearchIcon } from 'lucide-react';

export default function VideoSearch() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  useSeoMeta({
    title: query ? `Search: ${query} - VID` : 'Search - VID',
    description: `Search results for "${query}"`,
  });

  const { data: videos, isLoading, error } = useSearchVideos(query, 50);

  return (
    <VideoLayout>
      <div className="container py-6 px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SearchIcon className="h-6 w-6" />
            Search Results
          </h1>
          {query && (
            <p className="text-muted-foreground mt-1">
              Showing results for &quot;{query}&quot;
            </p>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load search results. Please try again later.
            </AlertDescription>
          </Alert>
        )}

        {!query && !isLoading && (
          <div className="text-center py-12">
            <SearchIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Enter a search query to find videos
            </p>
          </div>
        )}

        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="w-48 h-27 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && query && videos && videos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No videos found for &quot;{query}&quot;
            </p>
          </div>
        )}

        {!isLoading && videos && videos.length > 0 && (
          <div className="space-y-4">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} layout="list" />
            ))}
          </div>
        )}
      </div>
    </VideoLayout>
  );
}
