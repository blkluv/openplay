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
import { Loader2, AlertTriangle } from 'lucide-react';
import { useDeletePlaylistMutation, type Playlist } from '@/hooks/usePlaylists';
import { useToast } from '@/hooks/useToast';
import { useNavigate } from 'react-router-dom';
import { hexToNpub } from '@/lib/nostrUtils';

interface DeletePlaylistDialogProps {
  playlist: Playlist;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeletePlaylistDialog({ playlist, open, onOpenChange }: DeletePlaylistDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const deletePlaylistMutation = useDeletePlaylistMutation();

  const handleDelete = async () => {
    try {
      await deletePlaylistMutation.mutateAsync(playlist);

      toast({
        title: 'Playlist deleted',
        description: 'Your playlist has been deleted successfully',
      });

      onOpenChange(false);

      // Navigate back to channel page
      navigate(`/channel/${hexToNpub(playlist.pubkey)}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete playlist',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Playlist
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{playlist.title}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deletePlaylistMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deletePlaylistMutation.isPending}
          >
            {deletePlaylistMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Delete Playlist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
