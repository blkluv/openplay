import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { VideoLayout } from '@/components/video/VideoLayout';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { VideoCard } from '@/components/video/VideoCard';
import { useVideo, useVideos } from '@/hooks/useVideos';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, User, Share2, Flag, Edit, Trash2, ListPlus } from 'lucide-react';
import { formatRelativeTime } from '@/lib/videoUtils';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { ZapButton } from '@/components/ZapButton';
import { LikeButton } from '@/components/LikeButton';
import { AddToPlaylistDialog } from '@/components/playlists/AddToPlaylistDialog';
import { hexToNpub } from '@/lib/nostrUtils';
import { useToast } from '@/hooks/useToast';
import { ReportDialog } from '@/components/video/ReportDialog';
import { VideoEditDialog } from '@/components/video/VideoEditDialog';
import { VideoDeleteDialog } from '@/components/video/VideoDeleteDialog';
import { useState } from 'react';

export default function VideoWatch() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);

  // Pass the raw identifier to useVideo, which will handle decoding
  const { data: videoData, isLoading, error } = useVideo(eventId || '');
  const video = videoData?.video;
  const videoEvent = videoData?.event;
  const { data: author } = useAuthor(video?.pubkey);
  const { data: relatedVideos } = useVideos({ limit: 12 });
  const { user: currentUser } = useCurrentUser();
  const { toast } = useToast();

  // Check if current user owns this video
  const isOwner = currentUser && video && currentUser.pubkey === video.pubkey;

  const handleShare = async () => {
    if (!video) return;

    const shareUrl = window.location.href;
    const shareData = {
      title: video.title,
      text: video.content || `Watch ${video.title} on OpenPlay`,
      url: shareUrl,
    };

    // Try Web Share API first (mobile devices)
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled or share failed, fall back to clipboard
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    }

    // Fallback to copying link to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Link copied!',
        description: 'Video link has been copied to your clipboard',
      });
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      toast({
        title: 'Error',
        description: 'Failed to copy link to clipboard',
        variant: 'destructive',
      });
    }
  };

  useSeoMeta({
    title: video?.title || 'Watch Video',
    description: video?.content || 'Watch video on OpenPlay',
  });

  if (isLoading) {
    return (
      <VideoLayout showSidebar={false}>
        <div className="container py-6 px-4">
          <div className="grid lg:grid-cols-[1fr,400px] gap-6">
            <div className="space-y-4">
              <Skeleton className="aspect-video w-full" />
              <Skeleton className="h-8 w-3/4" />
              <div className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-2">
                  <Skeleton className="w-40 h-24" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </VideoLayout>
    );
  }

  if (error || !video) {
    return (
      <VideoLayout showSidebar={false}>
        <div className="container py-6 px-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Video not found or failed to load.
            </AlertDescription>
          </Alert>
        </div>
      </VideoLayout>
    );
  }

  return (
    <VideoLayout showSidebar={false}>
      <div className="container py-6 px-4">
        <div className="grid lg:grid-cols-[1fr,400px] gap-6">
          {/* Main Content */}
          <div className="space-y-4">
            {/* Video Player */}
            <VideoPlayer metadata={video.metadata} title={video.title} />

            {/* Video Info */}
            <div className="space-y-4">
              <h1 className="text-2xl font-bold">{video.title}</h1>

              {/* Hashtags */}
              {video.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {video.hashtags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Channel Info & Actions */}
              <div className="flex items-start justify-between gap-4">
                <Link
                  to={`/channel/${hexToNpub(video.pubkey)}`}
                  className="flex items-center gap-3 hover:opacity-80"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={author?.metadata?.picture} />
                    <AvatarFallback>
                      <User className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">
                      {author?.metadata?.name || author?.metadata?.display_name || 'Anonymous'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatRelativeTime(video.publishedAt || video.created_at)}
                    </p>
                  </div>
                </Link>

                <div className="flex items-center gap-2 flex-wrap">
                  {isOwner && videoEvent && (
                    <>
                      <VideoEditDialog videoEvent={videoEvent} video={video}>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </VideoEditDialog>
                      <VideoDeleteDialog videoEvent={videoEvent}>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </VideoDeleteDialog>
                    </>
                  )}
                  {videoEvent && (
                    <LikeButton
                      target={videoEvent}
                      variant="outline"
                      size="sm"
                      showCount={true}
                    />
                  )}
                  {videoEvent && (
                    <ZapButton
                      target={videoEvent}
                      variant="outline"
                      size="sm"
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPlaylistDialog(true)}
                  >
                    <ListPlus className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleShare}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                  {videoEvent && !isOwner && (
                    <ReportDialog videoEvent={videoEvent}>
                      <Button variant="ghost" size="sm">
                        <Flag className="h-4 w-4" />
                      </Button>
                    </ReportDialog>
                  )}
                </div>
              </div>

              <Separator />

              {/* Description */}
              {video.content && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Description</h3>
                  <p className="text-sm whitespace-pre-wrap">{video.content}</p>
                </div>
              )}

              {/* Segments/Chapters */}
              {video.segments.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Chapters</h3>
                  <div className="space-y-2">
                    {video.segments.map((segment, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-sm text-primary font-mono">
                          {segment.start}
                        </span>
                        <span className="text-sm">{segment.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Comments */}
              {videoEvent && <CommentsSection root={videoEvent} />}
            </div>
          </div>

          {/* Sidebar - Related Videos */}
          <div className="space-y-4">
            <h2 className="font-semibold">Related Videos</h2>
            {relatedVideos
              ?.filter((v) => v.id !== video.id)
              .slice(0, 10)
              .map((relatedVideo) => (
                <VideoCard
                  key={relatedVideo.id}
                  video={relatedVideo}
                  layout="list"
                />
              ))}
          </div>
        </div>
      </div>

      {/* Add to Playlist Dialog */}
      {video && (
        <AddToPlaylistDialog
          video={video}
          open={showPlaylistDialog}
          onOpenChange={setShowPlaylistDialog}
        />
      )}
    </VideoLayout>
  );
}
