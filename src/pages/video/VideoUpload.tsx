import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useToast } from '@/hooks/useToast';
import { Loader2, X, Upload, FileVideo, ImageIcon } from 'lucide-react';
import type { NostrEvent } from 'nostr-tools';
import type { VideoEvent } from '@/lib/videoUtils';
import { useQueryClient } from '@tanstack/react-query';

interface VideoEditDialogProps {
  videoEvent: NostrEvent;
  video: VideoEvent;
  children?: React.ReactNode;
}

export function VideoEditDialog({ videoEvent, video, children }: VideoEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.content || '');
  const [hashtags, setHashtags] = useState(video.hashtags.join(', '));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Video upload state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  // Changed default server to Azzamo (free)
  const [selectedServer, setSelectedServer] = useState('azzamo');
  const [customServer, setCustomServer] = useState('');
  const [videoMetadata, setVideoMetadata] = useState({
    width: video.metadata[0]?.dimensions?.width?.toString() || '',
    height: video.metadata[0]?.dimensions?.height?.toString() || '',
    duration: video.metadata[0]?.duration?.toString() || '',
  });

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const { publishEvent } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Added Azzamo server
  const blossomServers = {
    primal: 'https://blossom.primal.net/',
    nostr_build: 'https://blossom.band/',
    satellite: 'https://cdn.satellite.earth/',
    custom: customServer,
  };

  const uploadFile = useUploadFile({
    servers: [blossomServers[selectedServer as keyof typeof blossomServers]].filter(Boolean),
  });

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);

      // Auto-detect video metadata
      const videoEl = document.createElement('video');
      videoEl.preload = 'metadata';
      videoEl.onloadedmetadata = () => {
        setVideoMetadata({
          width: Math.round(videoEl.videoWidth).toString(),
          height: Math.round(videoEl.videoHeight).toString(),
          duration: videoEl.duration.toFixed(2),
        });
        window.URL.revokeObjectURL(videoEl.src);
      };
      videoEl.src = URL.createObjectURL(file);
    }
  };

  const handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      // Parse hashtags from comma-separated string
      const hashtagArray = hashtags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      // Get existing video metadata or prepare for new upload
      let videoUrl = video.metadata[0]?.url || '';
      let videoHash = video.metadata[0]?.hash || '';
      let videoMimeType = video.metadata[0]?.mimeType || 'video/mp4';
      let thumbnailUrl = video.metadata[0]?.previewImages[0] || '';

      // Upload new video if provided
      if (videoFile) {
        setUploadProgress(10);
        toast({
          title: 'Uploading Video',
          description: 'Uploading your video to Blossom server...',
        });

        const videoTags = await uploadFile.mutateAsync(videoFile);
        videoUrl = videoTags.find((t: string[]) => t[0] === 'url')?.[1] || videoUrl;
        videoHash = videoTags.find((t: string[]) => t[0] === 'x')?.[1] || '';
        videoMimeType = videoFile.type || 'video/mp4';

        setUploadProgress(60);
      }

      // Upload new thumbnail if provided
      if (thumbnailFile) {
        setUploadProgress(70);
        toast({
          title: 'Uploading Thumbnail',
          description: 'Uploading thumbnail...',
        });

        const thumbnailTags = await uploadFile.mutateAsync(thumbnailFile);
        thumbnailUrl = thumbnailTags.find((t: string[]) => t[0] === 'url')?.[1] || thumbnailUrl;

        setUploadProgress(80);
      }

      // Build imeta tag according to NIP-71
      const imetaParts: string[] = [];

      // Add dimensions
      if (videoMetadata.width && videoMetadata.height) {
        imetaParts.push(`dim ${videoMetadata.width}x${videoMetadata.height}`);
      }

      // Add primary URL
      imetaParts.push(`url ${videoUrl}`);

      // Add hash if available
      if (videoHash) {
        imetaParts.push(`x ${videoHash}`);
      }

      // Add mime type
      imetaParts.push(`m ${videoMimeType}`);

      // Add thumbnail/preview image(s)
      if (thumbnailUrl) {
        imetaParts.push(`image ${thumbnailUrl}`);
      }

      // Add service indicator
      imetaParts.push('service nip96');

      // Add duration
      if (videoMetadata.duration) {
        imetaParts.push(`duration ${videoMetadata.duration}`);
      }

      // Build tags array
      const tags: string[][] = [];

      // Add title
      tags.push(['title', title]);

      // Add published_at (preserve original if exists, otherwise use current timestamp)
      const publishedAt = video.publishedAt || video.created_at;
      tags.push(['published_at', Math.floor(publishedAt).toString()]);

      // Add imeta tag with video metadata
      tags.push(['imeta', ...imetaParts]);

      // Add hashtags
      hashtagArray.forEach((tag) => {
        tags.push(['t', tag]);
      });

      // Preserve segments if they exist
      const segmentTags = videoEvent.tags.filter((t) => t[0] === 'segment');
      tags.push(...segmentTags);

      // Preserve alt, content-warning, participants, references if they exist
      const altTag = videoEvent.tags.find((t) => t[0] === 'alt');
      if (altTag) tags.push(altTag);

      const contentWarningTag = videoEvent.tags.find((t) => t[0] === 'content-warning');
      if (contentWarningTag) tags.push(contentWarningTag);

      const participantTags = videoEvent.tags.filter((t) => t[0] === 'p');
      tags.push(...participantTags);

      const referenceTags = videoEvent.tags.filter((t) => t[0] === 'r');
      tags.push(...referenceTags);

      setUploadProgress(90);

      // Publish the updated event with the same kind as the original
      await publishEvent({
        kind: videoEvent.kind,
        content: description,
        tags,
      });

      setUploadProgress(100);

      toast({
        title: 'Video Updated',
        description: 'Your video has been updated successfully.',
      });

      // Invalidate video queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['video', videoEvent.id] });
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['videos-infinite'] });

      setOpen(false);
    } catch (error) {
      console.error('Failed to update video:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update your video. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    setTitle(video.title);
    setDescription(video.content || '');
    setHashtags(video.hashtags.join(', '));
    setVideoFile(null);
    setThumbnailFile(null);
    setUploadProgress(0);
    setVideoMetadata({
      width: video.metadata[0]?.dimensions?.width?.toString() || '',
      height: video.metadata[0]?.dimensions?.height?.toString() || '',
      duration: video.metadata[0]?.duration?.toString() || '',
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Video</DialogTitle>
          <DialogDescription>
            Update your video information. Changes will be published to all relays.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="space-y-2">
              <Label>Upload Progress</Label>
              <Progress value={uploadProgress} />
              <p className="text-xs text-muted-foreground text-center">{uploadProgress}%</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter video title"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your video..."
              rows={6}
              disabled={isSubmitting}
            />
          </div>

          {/* Video Upload Section */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <Label className="text-base">Replace Video (Optional)</Label>
              <div className="text-xs text-muted-foreground">
                Current: {video.metadata[0]?.url ? 'Uploaded' : 'No video'}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="server-select" className="text-sm">
                Blossom Server
              </Label>
              <Select
                value={selectedServer}
                onValueChange={setSelectedServer}
                disabled={isSubmitting}
              >
                <SelectTrigger id="server-select">
                  <SelectValue placeholder="Select server" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primal">Primal (blossom.primal.net)</SelectItem>
                  <SelectItem value="nostr_build">Nostr.build (blossom.band)</SelectItem>
                  <SelectItem value="satellite">Satellite (cdn.satellite.earth)</SelectItem>
                  <SelectItem value="custom">Custom Server</SelectItem>
                </SelectContent>
              </Select>

              {selectedServer === 'custom' && (
                <Input
                  placeholder="https://your-blossom-server.com/"
                  value={customServer}
                  onChange={(e) => setCustomServer(e.target.value)}
                  disabled={isSubmitting}
                />
              )}
            </div>

            <div className="space-y-2">
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoFileChange}
                className="hidden"
                disabled={isSubmitting}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => videoInputRef.current?.click()}
                disabled={isSubmitting}
                className="w-full"
              >
                <FileVideo className="h-4 w-4 mr-2" />
                {videoFile ? videoFile.name : 'Choose New Video File'}
              </Button>
            </div>

            {videoFile && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Size: {(videoFile.size / 1024 / 1024).toFixed(2)} MB</p>
                {videoMetadata.width && videoMetadata.height && (
                  <p>Dimensions: {videoMetadata.width}x{videoMetadata.height}</p>
                )}
                {videoMetadata.duration && (
                  <p>Duration: {parseFloat(videoMetadata.duration).toFixed(2)}s</p>
                )}
              </div>
            )}
          </div>

          {/* Thumbnail Upload Section */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <Label className="text-base">Replace Thumbnail (Optional)</Label>
              <div className="text-xs text-muted-foreground">
                Current: {video.metadata[0]?.previewImages[0] ? 'Uploaded' : 'No thumbnail'}
              </div>
            </div>

            <div className="space-y-2">
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/*"
                onChange={handleThumbnailFileChange}
                className="hidden"
                disabled={isSubmitting}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => thumbnailInputRef.current?.click()}
                disabled={isSubmitting}
                className="w-full"
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                {thumbnailFile ? thumbnailFile.name : 'Choose New Thumbnail'}
              </Button>
            </div>

            {thumbnailFile && (
              <div className="text-xs text-muted-foreground">
                <p>Size: {(thumbnailFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="hashtags">
              Hashtags
              <span className="text-xs text-muted-foreground ml-2">
                (comma-separated, without #)
              </span>
            </Label>
            <Input
              id="hashtags"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="e.g., bitcoin, nostr, technology"
              disabled={isSubmitting}
            />
            {hashtags && (
              <div className="flex flex-wrap gap-2 mt-2">
                {hashtags
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter((tag) => tag.length > 0)
                  .map((tag, index) => (
                    <div
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-xs"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => {
                          const tags = hashtags
                            .split(',')
                            .map((t) => t.trim())
                            .filter((t, i) => i !== index)
                            .join(', ');
                          setHashtags(tags);
                        }}
                        className="hover:text-destructive"
                        disabled={isSubmitting}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Video'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}