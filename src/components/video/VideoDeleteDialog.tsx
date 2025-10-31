import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { Loader2 } from 'lucide-react';
import type { NostrEvent } from 'nostr-tools';
import { useQueryClient } from '@tanstack/react-query';

interface VideoDeleteDialogProps {
  videoEvent: NostrEvent;
  children?: React.ReactNode;
}

export function VideoDeleteDialog({ videoEvent, children }: VideoDeleteDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { publishEvent } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      // Create a kind 5 deletion event (NIP-09)
      await publishEvent({
        kind: 5,
        content: 'Video deleted by author',
        tags: [
          ['e', videoEvent.id],
          ['k', videoEvent.kind.toString()],
        ],
      });

      toast({
        title: 'Video Deleted',
        description: 'Your video has been deleted successfully.',
      });

      // Invalidate video queries
      queryClient.invalidateQueries({ queryKey: ['video', videoEvent.id] });
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['videos-infinite'] });

      // Navigate back to home
      navigate('/');
    } catch (error) {
      console.error('Failed to delete video:', error);
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete your video. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setOpen(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Video</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this video? This action will publish a deletion event
            to all relays, but note that some relays may not honor deletion requests.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Video'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
