import { Button } from '@/components/ui/button';
import { useReactions } from '@/hooks/useReactions';
import { usePostReaction } from '@/hooks/usePostReaction';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { ThumbsUp } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import type { NostrEvent } from '@nostrify/nostrify';
import { cn } from '@/lib/utils';

interface LikeButtonProps {
  target: NostrEvent;
  className?: string;
  showCount?: boolean;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function LikeButton({
  target,
  className,
  showCount = true,
  variant = 'ghost',
  size = 'icon',
}: LikeButtonProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { data, isLoading } = useReactions(target);
  const { mutate: postReaction, isPending } = usePostReaction();

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to like videos',
        variant: 'destructive',
      });
      return;
    }

    if (data?.hasLiked) {
      toast({
        title: 'Already liked',
        description: 'You have already liked this video',
      });
      return;
    }

    postReaction(
      { target, content: '+' },
      {
        onSuccess: () => {
          toast({
            title: 'Liked!',
            description: 'You liked this video',
          });
        },
        onError: (error) => {
          toast({
            title: 'Failed to like',
            description: error.message || 'Something went wrong',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const count = data?.count ?? 0;
  const hasLiked = data?.hasLiked ?? false;
  const disabled = isLoading || isPending || !user;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleLike}
      disabled={disabled}
      className={cn(
        className,
        hasLiked && 'text-primary',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <ThumbsUp
        className={cn(
          'h-6 w-6',
          hasLiked && 'fill-current'
        )}
      />
      {showCount && count > 0 && (
        <span className="ml-1 text-xs">{count}</span>
      )}
    </Button>
  );
}
