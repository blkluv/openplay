import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { VideoLayout } from '@/components/video/VideoLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { useUploadFile } from '@/hooks/useUploadFile';
import { Upload, AlertCircle, Plus, X, FileVideo, Info } from 'lucide-react';
import { LoginArea } from '@/components/auth/LoginArea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';

export default function VideoUploadShort() {
  useSeoMeta({
    title: 'Upload Short - SHORTZ',
    description: 'Upload your short vertical video to the Web5 network',
  });

  const navigate = useNavigate();
  const { user: currentUser } = useCurrentUser();
  const { publishEvent } = useNostrPublish();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [duration, setDuration] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  // Changed default server to Azzamo (free)
  const [selectedServer, setSelectedServer] = useState('azzamo');
  const [customServer, setCustomServer] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // Added Azzamo server
  const blossomServers = {
    azzamo: 'https://blossom.azzamo.net/',
    primal: 'https://blossom.primal.net/',
    nostr_build: 'https://blossom.band/',
    satellite: 'https://cdn.satellite.earth/',
    custom: customServer,
  };

  const uploadFile = useUploadFile({
    servers: [blossomServers[selectedServer as keyof typeof blossomServers]].filter(Boolean),
  });

  if (!currentUser) {
    return (
      <VideoLayout>
        <div className="container py-12 px-4">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Sign In Required</CardTitle>
              <CardDescription>
                You need to sign in to upload shorts
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <LoginArea />
            </CardContent>
          </Card>
        </div>
      </VideoLayout>
    );
  }

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, '');
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag]);
      setHashtagInput('');
    }
  };

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter((t) => t !== tag));
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);

      // Auto-detect video metadata
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        setWidth(Math.round(video.videoWidth).toString());
        setHeight(Math.round(video.videoHeight).toString());
        setDuration(video.duration.toFixed(2));
        window.URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(file);
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

    if (!title) {
      toast({
        title: 'Missing Information',
        description: 'Please provide a title',
        variant: 'destructive',
      });
      return;
    }

    if (uploadMode === 'file' && !videoFile) {
      toast({
        title: 'Missing Short',
        description: 'Please select a short video file to upload',
        variant: 'destructive',
      });
      return;
    }

    if (uploadMode === 'url' && !videoUrl) {
      toast({
        title: 'Missing Short URL',
        description: 'Please provide a video URL',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      let finalVideoUrl = videoUrl;
      let finalThumbnailUrl = thumbnailUrl;

      let videoHash = '';
      let videoMimeType = 'video/mp4';

      // Upload video file if in file mode
      if (uploadMode === 'file' && videoFile) {
        setUploadProgress(10);
        toast({
          title: 'Uploading Video',
          description: 'Uploading your video to Blossom server...',
        });

        const videoTags = await uploadFile.mutateAsync(videoFile);
        finalVideoUrl = videoTags.find((t: string[]) => t[0] === 'url')?.[1] || '';
        videoHash = videoTags.find((t: string[]) => t[0] === 'x')?.[1] || '';
        videoMimeType = videoFile.type || 'video/mp4';

        setUploadProgress(60);
      }

      // Upload thumbnail if provided
      if (uploadMode === 'file' && thumbnailFile) {
        setUploadProgress(70);
        const thumbnailTags = await uploadFile.mutateAsync(thumbnailFile);
        finalThumbnailUrl = thumbnailTags.find((t: string[]) => t[0] === 'url')?.[1] || '';
        setUploadProgress(80);
      }

      // Build imeta tag according to NIP-71
      const imetaParts: string[] = [];

      // Add dimensions first (recommended order)
      if (width && height) {
        imetaParts.push(`dim ${width}x${height}`);
      }

      // Add primary URL
      imetaParts.push(`url ${finalVideoUrl}`);

      // Add hash if available
      if (videoHash) {
        imetaParts.push(`x ${videoHash}`);
      }

      // Add mime type
      imetaParts.push(`m ${videoMimeType}`);

      // Add thumbnail/preview image(s)
      if (finalThumbnailUrl) {
        imetaParts.push(`image ${finalThumbnailUrl}`);
      }

      // Add service indicator
      imetaParts.push('service nip96');

      // Add duration
      if (duration) {
        imetaParts.push(`duration ${duration}`);
      }

      // Build event tags
      const tags: string[][] = [
        ['title', title],
        ['published_at', Math.floor(Date.now() / 1000).toString()],
        ['imeta', ...imetaParts],
      ];

      // Add hashtags
      hashtags.forEach((tag) => {
        tags.push(['t', tag]);
      });

      setUploadProgress(90);

      // Publish the event
      const event = await publishEvent({
        kind: 22,
        content: description,
        tags,
      });

      setUploadProgress(100);

      if (event) {
        toast({
          title: 'Short Published!',
          description: 'Your short has been published to the network',
        });
        navigate(`/watch/${event.id}`);
      }
    } catch (error) {
      console.error('Failed to publish video:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to publish video. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <VideoLayout>
      <div className="container py-6 px-4">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Short
            </CardTitle>
            <CardDescription>
              Share your video with the decentralized network using Nostr NIP-71
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-6">
              <Info className="h-4 w-4" />
              <AlertTitle>About Blossom Media Storage</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p>Videos are uploaded to Blossom servers. For full movie uploads and reliable storage:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>Azzamo</strong> (blossom.azzamo.net) - Free to try (may have limits)</li>
                  <li><strong>Primal</strong> (blossom.primal.net) - Requires paid subscription</li>
                  <li><strong>Nostr.Build</strong> (blossom.band) - Requires paid subscription</li>
                  <li><strong>Satellite.earth</strong> (cdn.satellite.earth) - Requires paid subscription</li>
                </ul>
                <p className="text-sm mt-2">
                  <strong>Important:</strong> Uploads may fail or time out without a paid subscription on some servers.
                  Consider purchasing media storage or hosting your own Blossom server to own your media.
                </p>
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Upload Mode Selection */}
              <div className="space-y-2">
                <Label>Upload Mode</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={uploadMode === 'file' ? 'default' : 'outline'}
                    onClick={() => setUploadMode('file')}
                    className="flex-1"
                  >
                    <FileVideo className="mr-2 h-4 w-4" />
                    Upload File
                  </Button>
                  <Button
                    type="button"
                    variant={uploadMode === 'url' ? 'default' : 'outline'}
                    onClick={() => setUploadMode('url')}
                    className="flex-1"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Provide URL
                  </Button>
                </div>
              </div>

              {/* Blossom Server Selection (only for file upload mode) */}
              {uploadMode === 'file' && (
                <div className="space-y-2">
                  <Label htmlFor="server">Blossom Server</Label>
                  <Select value={selectedServer} onValueChange={setSelectedServer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a server" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="azzamo">Azzamo (blossom.azzamo.net)</SelectItem>
                      <SelectItem value="primal">Primal (blossom.primal.net)</SelectItem>
                      <SelectItem value="nostr_build">Nostr.Build (blossom.band)</SelectItem>
                      <SelectItem value="satellite">Satellite.earth (cdn.satellite.earth)</SelectItem>
                      <SelectItem value="custom">Custom Server</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedServer === 'custom' && (
                    <Input
                      value={customServer}
                      onChange={(e) => setCustomServer(e.target.value)}
                      placeholder="https://your-blossom-server.com/"
                      className="mt-2"
                    />
                  )}
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your video"
                  rows={4}
                />
              </div>

              {/* Video File/URL Input */}
              {uploadMode === 'file' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="videoFile">Video File *</Label>
                    <Input
                      id="videoFile"
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleVideoFileChange}
                      required
                    />
                    {videoFile && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="thumbnailFile">Thumbnail (Optional)</Label>
                    <Input
                      id="thumbnailFile"
                      ref={thumbnailInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailFileChange}
                    />
                    {thumbnailFile && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {thumbnailFile.name}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="videoUrl">Video URL *</Label>
                    <Input
                      id="videoUrl"
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://example.com/video.mp4"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="thumbnailUrl">Thumbnail URL</Label>
                    <Input
                      id="thumbnailUrl"
                      type="url"
                      value={thumbnailUrl}
                      onChange={(e) => setThumbnailUrl(e.target.value)}
                      placeholder="https://example.com/thumbnail.jpg"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (seconds)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="120"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="width">Width (px)</Label>
                  <Input
                    id="width"
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    placeholder="1920"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height (px)</Label>
                  <Input
                    id="height"
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="1080"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hashtags">Hashtags</Label>
                <div className="flex gap-2">
                  <Input
                    id="hashtags"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    placeholder="Add hashtag"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addHashtag();
                      }
                    }}
                  />
                  <Button type="button" onClick={addHashtag} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {hashtags.map((tag) => (
                      <div
                        key={tag}
                        className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => removeHashtag(tag)}
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isSubmitting && uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Upload Progress</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              <div className="flex gap-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Publishing...' : 'Publish Video'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/')}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </VideoLayout>
  );
}