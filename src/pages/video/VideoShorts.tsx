import { useSeoMeta } from '@unhead/react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useInfiniteVideos } from '@/hooks/useVideos';
import { useVideo } from '@/hooks/useVideos';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { useAuthor } from '@/hooks/useAuthor';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ZapButton } from '@/components/ZapButton';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, User, Share2, ChevronUp, ChevronDown, Volume2, VolumeX, MessageSquare } from 'lucide-react';
import { formatRelativeTime, getBestVideoSource, getAllVideoSources } from '@/lib/videoUtils';
import { hexToNpub, decodeVideoIdentifier } from '@/lib/nostrUtils';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import type { VideoEvent } from '@/lib/videoUtils';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { LikeButton } from '@/components/LikeButton';
import { nip19 } from 'nostr-tools';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export default function VideoShorts() {
  const { videoId } = useParams<{ videoId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get author filter from query params and decode if it's an npub
  const authorParam = searchParams.get('author');
  const authorPubkey = useMemo(() => {
    if (!authorParam) return undefined;

    // If it starts with npub, decode it
    if (authorParam.startsWith('npub')) {
      try {
        const decoded = nip19.decode(authorParam);
        if (decoded.type === 'npub') {
          return decoded.data as string;
        }
      } catch (error) {
        console.error('Failed to decode npub:', error);
        return undefined;
      }
    }

    // Otherwise assume it's already hex
    return authorParam;
  }, [authorParam]);

  // Get author metadata if filtering by author
  const { data: channelAuthor } = useAuthor(authorPubkey);

  useSeoMeta({
    title: authorPubkey && channelAuthor?.metadata?.name
      ? `${channelAuthor.metadata.name}'s Shorts - OpenPlay`
      : 'Shorts - OpenPlay',
    description: 'Watch short-form vertical videos on the decentralized Nostr network',
  });

  // Fetch shorts (filtered by author if provided)
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteVideos({
    pageSize: 20,
    kinds: [22, 34236], // Vertical video kinds
    authors: authorPubkey ? [authorPubkey] : undefined,
  });

  // Flatten all pages and deduplicate by video ID
  const videos = data?.pages.flatMap((page) => page.videos) ?? [];
  const uniqueVideos = videos.reduce((acc, video) => {
    if (!acc.find(v => v.id === video.id)) {
      acc.push(video);
    }
    return acc;
  }, [] as typeof videos);

  // Decode the video identifier if provided
  const decodedInfo = videoId ? decodeVideoIdentifier(videoId) : null;
  const targetEventId = decodedInfo?.id || videoId;

  // Helper function to build URL with author query param preserved
  const buildShortsUrl = useCallback((videoId: string) => {
    const base = `/shorts/${videoId}`;
    if (authorParam) {
      return `${base}?author=${authorParam}`;
    }
    return base;
  }, [authorParam]);

  // Find the index of the target video if provided
  useEffect(() => {
    if (targetEventId && uniqueVideos.length > 0) {
      const index = uniqueVideos.findIndex(v => v.id === targetEventId);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [targetEventId, uniqueVideos]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' && currentIndex > 0) {
        const prevIndex = currentIndex - 1;
        setCurrentIndex(prevIndex);
        const prevVideo = uniqueVideos[prevIndex];
        if (prevVideo) {
          navigate(buildShortsUrl(prevVideo.id), { replace: true });
        }
      } else if (e.key === 'ArrowDown' && currentIndex < uniqueVideos.length - 1) {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        const nextVideo = uniqueVideos[nextIndex];
        if (nextVideo) {
          navigate(buildShortsUrl(nextVideo.id), { replace: true });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, uniqueVideos.length, navigate, uniqueVideos, buildShortsUrl]);

  // Handle mouse wheel navigation with debouncing
  useEffect(() => {
    let isScrolling = false;

    const handleWheel = (e: WheelEvent) => {
      if (isScrolling) return;

      e.preventDefault();
      isScrolling = true;

      if (e.deltaY > 0 && currentIndex < uniqueVideos.length - 1) {
        // Scroll down - next video
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        const nextVideo = uniqueVideos[nextIndex];
        if (nextVideo) {
          navigate(buildShortsUrl(nextVideo.id), { replace: true });
        }
      } else if (e.deltaY < 0 && currentIndex > 0) {
        // Scroll up - previous video
        const prevIndex = currentIndex - 1;
        setCurrentIndex(prevIndex);
        const prevVideo = uniqueVideos[prevIndex];
        if (prevVideo) {
          navigate(buildShortsUrl(prevVideo.id), { replace: true });
        }
      }

      // Debounce for 800ms to prevent rapid scrolling
      setTimeout(() => {
        isScrolling = false;
      }, 800);
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [currentIndex, uniqueVideos.length, navigate, uniqueVideos, buildShortsUrl]);

  // Auto-fetch more when near the end
  useEffect(() => {
    if (currentIndex >= uniqueVideos.length - 3 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [currentIndex, uniqueVideos.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const goToNext = () => {
    if (currentIndex < uniqueVideos.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      const nextVideo = uniqueVideos[nextIndex];
      if (nextVideo) {
        navigate(buildShortsUrl(nextVideo.id), { replace: true });
      }
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      const prevVideo = uniqueVideos[prevIndex];
      if (prevVideo) {
        navigate(buildShortsUrl(prevVideo.id), { replace: true });
      }
    }
  };

  const handleShare = async (video: VideoEvent) => {
    const shareUrl = `${window.location.origin}/shorts/${video.id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: video.title,
          text: video.content || `Watch ${video.title} on OpenPlay`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: 'Link copied!',
          description: 'Short link has been copied to your clipboard',
        });
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Skeleton className="w-full h-full max-w-[500px]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center p-4">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Unable to connect to relays. Check your internet connection and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (uniqueVideos.length === 0) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-6xl">📱</div>
          <h2 className="text-xl font-semibold text-foreground">No Shorts Yet</h2>
          <p className="text-muted-foreground">
            Be the first to share a short vertical video on OpenPlay!
          </p>
        </div>
      </div>
    );
  }

  const currentVideo = uniqueVideos[currentIndex];

  return (
    <div ref={containerRef} className="fixed inset-0 bg-background overflow-hidden z-50">
      {/* Video Container */}
      <div className="relative w-full h-full flex items-center justify-center">
        <ShortVideoPlayer
          video={currentVideo}
          muted={muted}
          onEnded={goToNext}
        />

        {/* Overlay Controls */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Top Navigation */}
          <div className="absolute top-4 left-4 pointer-events-auto z-20">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-foreground hover:bg-accent"
            >
              ← Back
            </Button>
          </div>

          {/* Side Actions */}
          <div className="absolute right-4 bottom-24 flex flex-col gap-4 pointer-events-auto z-20">
            {/* Mute Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMuted(!muted)}
              className="rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-accent h-12 w-12"
            >
              {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
            </Button>

            {/* Like */}
            <LikeButton
              target={currentVideo}
              showCount={false}
              variant="ghost"
              size="icon"
              className="rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-accent h-12 w-12"
            />

            {/* Comments */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowComments(true)}
              className="rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-accent h-12 w-12"
            >
              <MessageSquare className="h-6 w-6" />
            </Button>

            {/* Zap */}
            <ZapButton
              target={currentVideo}
              showCount={false}
              className="rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-accent h-12 w-12 flex items-center justify-center"
            />

            {/* Share */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleShare(currentVideo)}
              className="rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-accent h-12 w-12"
            >
              <Share2 className="h-6 w-6" />
            </Button>
          </div>

          {/* Video Info */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background/90 via-background/50 to-transparent backdrop-blur-sm pointer-events-auto">
            <div className="max-w-[500px] mx-auto space-y-2">
              <VideoAuthorInfo video={currentVideo} />
              <h3 className="text-foreground font-semibold text-lg">{currentVideo.title}</h3>
              {currentVideo.content && (
                <p className="text-muted-foreground text-sm line-clamp-2">{currentVideo.content}</p>
              )}
              {currentVideo.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {currentVideo.hashtags.map((tag) => (
                    <span key={tag} className="text-muted-foreground text-sm">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Navigation Arrows */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 pointer-events-auto">
            {currentIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrevious}
                className="rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-accent h-12 w-12"
              >
                <ChevronUp className="h-8 w-8" />
              </Button>
            )}
            {currentIndex < uniqueVideos.length - 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNext}
                className="rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-accent h-12 w-12"
              >
                <ChevronDown className="h-8 w-8" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Comments Sheet */}
      <Sheet open={showComments} onOpenChange={setShowComments}>
        <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Comments</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <CommentsSection root={currentVideo} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Component to display video with auto-play
function ShortVideoPlayer({ video, muted, onEnded }: { video: VideoEvent; muted: boolean; onEnded: () => void }) {
  const bestSource = getBestVideoSource(video.metadata);
  const videoUrl = bestSource ? getAllVideoSources(bestSource)[0] : undefined;

  if (!videoUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <User className="h-16 w-16 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full max-w-[500px] bg-background">
      <video
        key={video.id}
        src={videoUrl}
        className="w-full h-full object-contain"
        autoPlay
        loop={false}
        muted={muted}
        playsInline
        onEnded={onEnded}
        controls={false}
      />
    </div>
  );
}

// Component to display author info
function VideoAuthorInfo({ video }: { video: VideoEvent }) {
  const { data: author } = useAuthor(video.pubkey);

  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10 border-2 border-border">
        <AvatarImage src={author?.metadata?.picture} />
        <AvatarFallback>
          <User className="h-5 w-5" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-foreground font-semibold text-sm">
          {author?.metadata?.name || author?.metadata?.display_name || 'Anonymous'}
        </p>
        <p className="text-muted-foreground text-xs">
          {formatRelativeTime(video.publishedAt || video.created_at)}
        </p>
      </div>
    </div>
  );
}
