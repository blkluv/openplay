import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Trash2, GripVertical } from 'lucide-react';
import { useCreatePlaylistMutation, useRemoveFromPlaylistMutation, type Playlist } from '@/hooks/usePlaylists';
import { useToast } from '@/hooks/useToast';
import { useVideo } from '@/hooks/useVideos';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EditPlaylistDialogProps {
  playlist: Playlist;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export function EditPlaylistDialog({ playlist, open, onOpenChange, onUpdated }: EditPlaylistDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description || '');
  const [image, setImage] = useState(playlist.image || '');

  const updatePlaylistMutation = useCreatePlaylistMutation();
  const removeVideoMutation = useRemoveFromPlaylistMutation();

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a playlist title',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updatePlaylistMutation.mutateAsync({
        dTag: playlist.d,
        title: title.trim(),
        description: description.trim() || undefined,
        image: image.trim() || undefined,
        videoIds: playlist.videoIds,
      });

      toast({
        title: 'Success',
        description: 'Playlist updated successfully',
      });

      onOpenChange(false);
      if (onUpdated) onUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update playlist',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveVideo = async (videoId: string) => {
    try {
      await removeVideoMutation.mutateAsync({
        playlist,
        videoId,
      });

      toast({
        title: 'Success',
        description: 'Video removed from playlist',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove video',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Playlist</DialogTitle>
          <DialogDescription>
            Update your playlist details and manage videos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden">
          {/* Playlist Details */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Awesome Playlist"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your playlist..."
                className="mt-1.5 min-h-[80px]"
              />
            </div>

            <div>
              <Label htmlFor="image">Thumbnail URL (optional)</Label>
              <Input
                id="image"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://example.com/thumbnail.jpg"
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Video List */}
          <div className="space-y-2">
            <Label>Videos ({playlist.videoIds.length})</Label>
            <ScrollArea className="h-[200px] rounded-md border">
              <div className="p-4 space-y-2">
                {playlist.videoIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No videos in this playlist
                  </p>
                ) : (
                  playlist.videoIds.map((videoId) => (
                    <PlaylistVideoItem
                      key={videoId}
                      videoId={videoId}
                      onRemove={() => handleRemoveVideo(videoId)}
                      isRemoving={removeVideoMutation.isPending}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updatePlaylistMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updatePlaylistMutation.isPending || !title.trim()}
          >
            {updatePlaylistMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Component to display individual video items in the playlist
function PlaylistVideoItem({
  videoId,
  onRemove,
  isRemoving,
}: {
  videoId: string;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const { data: videoData } = useVideo(videoId);
  const video = videoData?.video;

  return (
    <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted group">
      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {video?.title || 'Loading...'}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        disabled={isRemoving}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
