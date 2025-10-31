import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus, ListVideo } from 'lucide-react';
import { usePlaylists, useCreatePlaylistMutation, useAddToPlaylistMutation } from '@/hooks/usePlaylists';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import type { VideoEvent } from '@/lib/videoUtils';

interface AddToPlaylistDialogProps {
  video: VideoEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddToPlaylistDialog({ video, open, onOpenChange }: AddToPlaylistDialogProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const { data: playlists, isLoading } = usePlaylists(user?.pubkey);
  const createPlaylistMutation = useCreatePlaylistMutation();
  const addToPlaylistMutation = useAddToPlaylistMutation();

  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a playlist name',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Create a unique d tag using timestamp
      const dTag = `playlist-${Date.now()}`;

      await createPlaylistMutation.mutateAsync({
        dTag,
        title: newPlaylistName,
        videoIds: [video.id],
      });

      toast({
        title: 'Success',
        description: `Created "${newPlaylistName}" and added video`,
      });

      setNewPlaylistName('');
      setShowNewPlaylist(false);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create playlist',
        variant: 'destructive',
      });
    }
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    const playlist = playlists?.find(p => p.id === playlistId);
    if (!playlist) return;

    try {
      await addToPlaylistMutation.mutateAsync({
        playlist,
        videoId: video.id,
      });

      toast({
        title: 'Success',
        description: `Added to "${playlist.title}"`,
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add to playlist',
        variant: 'destructive',
      });
    }
  };

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save to Playlist</DialogTitle>
            <DialogDescription>
              Sign in to create playlists and save videos
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save to Playlist</DialogTitle>
          <DialogDescription>
            Add "{video.title}" to a playlist
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing playlists */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && playlists && playlists.length > 0 && (
            <ScrollArea className="h-[200px] rounded-md border">
              <div className="p-4 space-y-2">
                {playlists.map((playlist) => {
                  const isInPlaylist = playlist.videoIds.includes(video.id);
                  return (
                    <div
                      key={playlist.id}
                      className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                      onClick={() => !isInPlaylist && handleAddToPlaylist(playlist.id)}
                    >
                      <Checkbox
                        checked={isInPlaylist}
                        disabled={isInPlaylist || addToPlaylistMutation.isPending}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{playlist.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {playlist.videoIds.length} {playlist.videoIds.length === 1 ? 'video' : 'videos'}
                        </p>
                      </div>
                      {playlist.image && (
                        <img
                          src={playlist.image}
                          alt=""
                          className="h-8 w-12 object-cover rounded"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {!isLoading && (!playlists || playlists.length === 0) && !showNewPlaylist && (
            <div className="text-center py-8 text-muted-foreground">
              <ListVideo className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">You don't have any playlists yet</p>
            </div>
          )}

          {/* Create new playlist */}
          {!showNewPlaylist && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowNewPlaylist(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Playlist
            </Button>
          )}

          {showNewPlaylist && (
            <div className="space-y-3 p-4 border rounded-md">
              <div>
                <Label htmlFor="playlist-name">Playlist Name</Label>
                <Input
                  id="playlist-name"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="My Awesome Playlist"
                  className="mt-1.5"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateAndAdd();
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreateAndAdd}
                  disabled={createPlaylistMutation.isPending || !newPlaylistName.trim()}
                  className="flex-1"
                >
                  {createPlaylistMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Create & Add
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewPlaylist(false);
                    setNewPlaylistName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
