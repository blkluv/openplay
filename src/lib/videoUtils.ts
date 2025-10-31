import type { NostrEvent } from 'nostr-tools';

export interface VideoMetadata {
  url: string;
  fallbacks: string[];
  mimeType: string;
  dimensions?: { width: number; height: number };
  hash?: string;
  previewImages: string[];
  duration?: number;
  bitrate?: number;
  service?: string;
}

export interface VideoEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  sig: string;
  title: string;
  publishedAt?: number;
  alt?: string;
  contentWarning?: string;
  hashtags: string[];
  participants: string[];
  references: string[];
  segments: VideoSegment[];
  metadata: VideoMetadata[];
}

export interface VideoSegment {
  start: string;
  end: string;
  title: string;
  thumbnail?: string;
}

/**
 * Parse a video event from a Nostr event
 * Supports: kind 21 (horizontal), 34235 (horizontal legacy), 22 (vertical short), 34236 (vertical short legacy)
 */
export function parseVideoEvent(event: NostrEvent): VideoEvent | null {
  // kind 21 = normal/horizontal video (new format)
  // kind 34235 = normal/horizontal video (legacy format)
  // kind 22 = vertical short video (new format)
  // kind 34236 = vertical short video (legacy format)
  if (event.kind !== 21 && event.kind !== 34235 && event.kind !== 22 && event.kind !== 34236) {
    return null;
  }

  const tags = event.tags;
  const title = tags.find((t) => t[0] === 'title')?.[1] || 'Untitled Video';
  const publishedAt = tags.find((t) => t[0] === 'published_at')?.[1];
  const alt = tags.find((t) => t[0] === 'alt')?.[1];
  const contentWarning = tags.find((t) => t[0] === 'content-warning')?.[1];
  const hashtags = tags.filter((t) => t[0] === 't').map((t) => t[1]);
  const participants = tags.filter((t) => t[0] === 'p').map((t) => t[1]);
  const references = tags.filter((t) => t[0] === 'r').map((t) => t[1]);

  // Parse segments
  const segments: VideoSegment[] = tags
    .filter((t) => t[0] === 'segment')
    .map((t) => ({
      start: t[1],
      end: t[2],
      title: t[3] || '',
      thumbnail: t[4],
    }));

  // Parse imeta tags for video metadata
  const metadata: VideoMetadata[] = tags
    .filter((t) => t[0] === 'imeta')
    .map((t) => {
      const meta: VideoMetadata = {
        url: '',
        fallbacks: [],
        mimeType: '',
        previewImages: [],
      };

      for (let i = 1; i < t.length; i++) {
        const part = t[i];
        if (part.startsWith('url ')) {
          meta.url = part.substring(4);
        } else if (part.startsWith('fallback ')) {
          meta.fallbacks.push(part.substring(9));
        } else if (part.startsWith('m ')) {
          meta.mimeType = part.substring(2);
        } else if (part.startsWith('dim ')) {
          const dims = part.substring(4).split('x');
          if (dims.length === 2) {
            meta.dimensions = {
              width: parseInt(dims[0], 10),
              height: parseInt(dims[1], 10),
            };
          }
        } else if (part.startsWith('x ')) {
          meta.hash = part.substring(2);
        } else if (part.startsWith('image ')) {
          meta.previewImages.push(part.substring(6));
        } else if (part.startsWith('duration ')) {
          meta.duration = parseFloat(part.substring(9));
        } else if (part.startsWith('bitrate ')) {
          meta.bitrate = parseInt(part.substring(8), 10);
        } else if (part.startsWith('service ')) {
          meta.service = part.substring(8);
        }
      }

      return meta;
    });

  return {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    content: event.content,
    sig: event.sig,
    title,
    publishedAt: publishedAt ? parseInt(publishedAt, 10) : undefined,
    alt,
    contentWarning,
    hashtags,
    participants,
    references,
    segments,
    metadata,
  };
}

/**
 * Get the best video source from metadata (prefers highest quality)
 */
export function getBestVideoSource(metadata: VideoMetadata[]): VideoMetadata | null {
  if (metadata.length === 0) return null;

  // Sort by resolution (width * height) descending
  const sorted = [...metadata].sort((a, b) => {
    const aSize = a.dimensions ? a.dimensions.width * a.dimensions.height : 0;
    const bSize = b.dimensions ? b.dimensions.width * b.dimensions.height : 0;
    return bSize - aSize;
  });

  return sorted[0];
}

/**
 * Get all available video sources with URLs
 */
export function getAllVideoSources(metadata: VideoMetadata): string[] {
  const sources = [metadata.url, ...metadata.fallbacks];
  return sources.filter(Boolean);
}

/**
 * Format duration in seconds to HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format view count (e.g., 1234 -> 1.2K)
 */
export function formatViewCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  if (count < 1000000000) return `${(count / 1000000).toFixed(1)}M`;
  return `${(count / 1000000000).toFixed(1)}B`;
}

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} months ago`;
  return `${Math.floor(diff / 31536000)} years ago`;
}
