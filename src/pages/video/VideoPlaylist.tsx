import { useParams, Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { VideoLayout } from '@/components/video/VideoLayout';
import { VideoCard } from '@/components/video/VideoCard';
import { usePlaylist } from '@/hooks/usePlaylists';
import { useVideo } from '@/hooks/useVideos';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, User, ListVideo, Share2, Edit, Trash2 } from 'lucide-react';
import { formatRelativeTime } from '@/lib/videoUtils';
import { nip19 } from 'nostr-tools';
import { useMemo, useState } from 'react';
import { hexToNpub } from '@/lib/nostrUtils';
import { useToast } from '@/hooks/useToast';
import { EditPlaylistDialog } from '@/components/playlists/EditPlaylistDialog';
import { DeletePlaylistDialog } from '@/components/playlists/DeletePlaylistDialog';

export default function VideoPlaylist() {
  const { pubkey: pubkeyParam, dTag } = useParams<{ pubkey: string; dTag: string }>();
  const { toast } = useToast();
  const { user: currentUser } = useCurrentUser();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

  const { data: playlist, isLoading: playlistLoading, error: playlistError } = usePlaylist(pubkey || '', dTag || '');
  const { data: author } = useAuthor(pubkey);

  // Check if current user owns this playlist
  const isOwner = currentUser && playlist && currentUser.pubkey === playlist.pubkey;

  useSeoMeta({
    title: playlist?.title ? `${playlist.title} - VID` : 'Playlist - VID',
    description: playlist?.description || 'View playlist on VID',
  });

  const handleShare = async () => {
    if (!playlist) return;

    const shareUrl = window.location.href;
    const shareData = {
      title: playlist.title,
      text: playlist.description || `Check out ${playlist.title} on VID`,
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
        description: 'Playlist link has been copied to your clipboard',
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

  if (playlistLoading) {
    return (
      <VideoLayout>
        <div className="container py-6 px-4">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <Skeleton className="h-24 w-24 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-96" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video rounded-lg" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </VideoLayout>
    );
  }

  if (playlistError || !playlist) {
    return (
      <VideoLayout>
        <div className="container py-6 px-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Playlist not found or failed to load.
            </AlertDescription>
          </Alert>
        </div>
      </VideoLayout>
    );
  }

  return (
    <VideoLayout>
      <div className="container py-6 px-4">
        {/* Playlist Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Playlist Thumbnail */}
            <div className="w-full md:w-64 aspect-video rounded-lg overflow-hidden bg-muted flex-shrink-0">
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
            </div>

            {/* Playlist Info */}
            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">{playlist.title}</h1>
                {playlist.description && (
                  <p className="text-muted-foreground whitespace-pre-wrap">{playlist.description}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <Link
                  to={`/channel/${hexToNpub(playlist.pubkey)}`}
                  className="flex items-center gap-2 hover:text-foreground transition-colors"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={author?.metadata?.picture} />
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">
                    {author?.metadata?.name || author?.metadata?.display_name || 'Anonymous'}
                  </span>
                </Link>
                <span>•</span>
                <span>{playlist.videoIds.length} videos</span>
                <span>•</span>
                <span>{formatRelativeTime(playlist.created_at)}</span>
              </div>

              <div className="flex items-center gap-2">
                {isOwner && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowDeleteDialog(true)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Videos Grid */}
        {playlist.videoIds.length === 0 ? (
          <div className="text-center py-12">
            <ListVideo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">This playlist is empty</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Videos</h2>
            {/* Mobile: Single column */}
            <div className="lg:hidden space-y-4 w-full max-w-full overflow-hidden">
              {playlist.videoIds.map((videoId) => (
                <PlaylistVideoCard key={videoId} videoId={videoId} />
              ))}
            </div>
            {/* Desktop: 3 column grid */}
            <div className="hidden lg:grid lg:grid-cols-3 gap-4">
              {playlist.videoIds.map((videoId) => (
                <PlaylistVideoCard key={videoId} videoId={videoId} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Playlist Dialog */}
      {playlist && isOwner && (
        <EditPlaylistDialog
          playlist={playlist}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}

      {/* Delete Playlist Dialog */}
      {playlist && isOwner && (
        <DeletePlaylistDialog
          playlist={playlist}
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
        />
      )}
    </VideoLayout>
  );
}

// Component to load and display individual video cards
function PlaylistVideoCard({ videoId }: { videoId: string }) {
  const { data: videoData, isLoading, error } = useVideo(videoId);
  const video = videoData?.video;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="aspect-video rounded-lg" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Video unavailable</p>
      </div>
    );
  }

  return <VideoCard video={video} layout="grid" />;
}
