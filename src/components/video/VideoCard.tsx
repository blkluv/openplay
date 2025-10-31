import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Volume2, VolumeX } from 'lucide-react';
import { useAuthor } from '@/hooks/useAuthor';
import type { VideoEvent } from '@/lib/videoUtils';
import {
  formatDuration,
  formatRelativeTime,
  getBestVideoSource,
  getAllVideoSources,
} from '@/lib/videoUtils';
import { hexToNpub, encodeVideoEvent } from '@/lib/nostrUtils';
import { useState, useRef } from 'react';

interface VideoCardProps {
  video: VideoEvent;
  layout?: 'grid' | 'list' | 'vertical' | 'auto';
  channelContext?: string; // pubkey of channel if viewing from channel page
}

export function VideoCard({ video, layout = 'auto', channelContext }: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    // Get mute preference from localStorage, default to true
    const savedMutePreference = localStorage.getItem('videoCardMuted');
    return savedMutePreference === null ? true : savedMutePreference === 'true';
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const { data: author } = useAuthor(video.pubkey);
  const bestSource = getBestVideoSource(video.metadata);
  const thumbnail = bestSource?.previewImages[0];
  const videoUrl = bestSource ? getAllVideoSources(bestSource)[0] : undefined;
  const duration = bestSource?.duration;

  // Auto-detect layout based on video kind if layout is 'auto'
  const isShort = video.kind === 22 || video.kind === 34236;
  const effectiveLayout = layout === 'auto' ? (isShort ? 'vertical' : 'grid') : layout;

  // Encode video event to NIP-19 format (naddr or nevent)
  const videoIdentifier = encodeVideoEvent(video);

  // Shorts should link to /shorts/:id for the TikTok-style feed
  // Regular videos should link to /watch/:id
  // If channelContext is provided and this is a short, add author query param
  const videoLink = isShort
    ? channelContext
      ? `/shorts/${videoIdentifier}?author=${hexToNpub(channelContext)}`
      : `/shorts/${videoIdentifier}`
    : `/watch/${videoIdentifier}`;

  // Handle hover play/pause
  const handleMouseEnter = () => {
    setIsHovered(true);
    // Read fresh preference from localStorage on each hover
    const savedMutePreference = localStorage.getItem('videoCardMuted');
    const shouldBeMuted = savedMutePreference === null ? true : savedMutePreference === 'true';
    setIsMuted(shouldBeMuted);

    if (videoRef.current && videoUrl) {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = shouldBeMuted; // Apply fresh preference
      videoRef.current.play().catch(() => {
        // Autoplay may be blocked by browser
      });
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      videoRef.current.muted = true; // Mute the video element when leaving
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    // Save preference to localStorage so it persists across all video cards
    localStorage.setItem('videoCardMuted', String(newMutedState));
    if (videoRef.current) {
      videoRef.current.muted = newMutedState;
    }
  };

  // Vertical layout for shorts
  if (effectiveLayout === 'vertical') {
    return (
      <Card className="overflow-hidden transition-all duration-200 hover:shadow-xl hover:shadow-primary/20 hover:-translate-y-1 w-full">
        <div
          className="relative"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Link to={videoLink} className="block">
            <div className="relative aspect-[9/16] bg-muted w-full">
              {videoUrl ? (
                <>
                  {!isHovered && thumbnail && (
                    <img
                      src={thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className={`w-full h-full object-cover ${!isHovered && thumbnail ? 'hidden' : ''}`}
                    loop
                    muted={isMuted}
                    playsInline
                  />
                </>
              ) : thumbnail ? (
                <img
                  src={thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              {duration && !isHovered && (
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                  {formatDuration(duration)}
                </div>
              )}
            </div>
          </Link>
          {isHovered && videoUrl && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white z-10"
              onClick={toggleMute}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        <div className="p-3">
          <div className="flex gap-3">
            <Link to={`/channel/${hexToNpub(video.pubkey)}`} className="flex-shrink-0">
              <Avatar className="h-9 w-9">
                <AvatarImage src={author?.metadata?.picture} />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0">
              <Link to={videoLink}>
                <h3 className="font-semibold line-clamp-2 text-sm hover:text-primary">
                  {video.title}
                </h3>
              </Link>
              <Link
                to={`/channel/${hexToNpub(video.pubkey)}`}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {author?.metadata?.name || author?.metadata?.display_name || 'Anonymous'}
              </Link>
              <p className="text-xs text-muted-foreground">
                {formatRelativeTime(video.publishedAt || video.created_at)}
              </p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (effectiveLayout === 'list') {
    return (
      <div className="flex gap-4 p-2 hover:bg-accent/50 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-primary/10 w-full">
        <div
          className="relative flex-shrink-0"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Link to={videoLink} className="block">
            <div className="relative w-48 h-27 rounded-lg overflow-hidden bg-muted">
              {videoUrl ? (
                <>
                  {!isHovered && thumbnail && (
                    <img
                      src={thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className={`w-full h-full object-cover ${!isHovered && thumbnail ? 'hidden' : ''}`}
                    loop
                    muted={isMuted}
                    playsInline
                  />
                </>
              ) : thumbnail ? (
                <img
                  src={thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              {duration && !isHovered && (
                <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                  {formatDuration(duration)}
                </div>
              )}
            </div>
          </Link>
          {isHovered && videoUrl && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white z-10"
              onClick={toggleMute}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Link to={videoLink}>
            <h3 className="font-semibold line-clamp-2 hover:text-primary">
              {video.title}
            </h3>
          </Link>
          <Link
            to={`/channel/${hexToNpub(video.pubkey)}`}
            className="flex items-center gap-2 mt-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={author?.metadata?.picture} />
              <AvatarFallback>
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <span>{author?.metadata?.name || author?.metadata?.display_name || 'Anonymous'}</span>
          </Link>
          <p className="text-sm text-muted-foreground mt-1">
            {formatRelativeTime(video.publishedAt || video.created_at)}
          </p>
          {video.content && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {video.content}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-xl hover:shadow-primary/20 hover:-translate-y-1 w-full max-w-full box-border">
      <div
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Link to={videoLink} className="block w-full max-w-full">
          <div className="relative aspect-video bg-muted w-full max-w-full overflow-hidden">
            {videoUrl ? (
              <>
                {!isHovered && thumbnail && (
                  <img
                    src={thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                )}
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className={`w-full h-full object-cover ${!isHovered && thumbnail ? 'hidden' : ''}`}
                  loop
                  muted={isMuted}
                  playsInline
                />
              </>
            ) : thumbnail ? (
              <img
                src={thumbnail}
                alt={video.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            {duration && !isHovered && (
              <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                {formatDuration(duration)}
              </div>
            )}
          </div>
        </Link>
        {isHovered && videoUrl && (
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white z-10"
            onClick={toggleMute}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      <div className="p-3 w-full">
        <div className="flex gap-3 w-full">
          <Link to={`/channel/${hexToNpub(video.pubkey)}`} className="flex-shrink-0">
            <Avatar className="h-9 w-9">
              <AvatarImage src={author?.metadata?.picture} />
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0 overflow-hidden">
            <Link to={videoLink} className="block">
              <h3 className="font-semibold line-clamp-2 text-sm hover:text-primary break-words">
                {video.title}
              </h3>
            </Link>
            <Link
              to={`/channel/${hexToNpub(video.pubkey)}`}
              className="text-sm text-muted-foreground hover:text-foreground block truncate"
            >
              {author?.metadata?.name || author?.metadata?.display_name || 'Anonymous'}
            </Link>
            <p className="text-xs text-muted-foreground">
              {formatRelativeTime(video.publishedAt || video.created_at)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
