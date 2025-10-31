import { nip19 } from 'nostr-tools';
import type { VideoEvent } from './videoUtils';

/**
 * Convert a hex pubkey to npub format
 */
export function hexToNpub(hex: string): string {
  try {
    return nip19.npubEncode(hex);
  } catch (error) {
    console.error('Failed to encode npub:', error);
    return hex;
  }
}

/**
 * Convert npub to hex pubkey
 */
export function npubToHex(npub: string): string | undefined {
  try {
    const decoded = nip19.decode(npub);
    if (decoded.type === 'npub') {
      return decoded.data as string;
    }
  } catch (error) {
    console.error('Failed to decode npub:', error);
  }
  return undefined;
}

/**
 * Convert a hex event ID to note format
 */
export function hexToNote(hex: string): string {
  try {
    return nip19.noteEncode(hex);
  } catch (error) {
    console.error('Failed to encode note:', error);
    return hex;
  }
}

/**
 * Convert note to hex event ID
 */
export function noteToHex(note: string): string | undefined {
  try {
    const decoded = nip19.decode(note);
    if (decoded.type === 'note') {
      return decoded.data as string;
    }
  } catch (error) {
    console.error('Failed to decode note:', error);
  }
  return undefined;
}

/**
 * Encode a video event to NIP-19 format
 * - Uses naddr for parameterized replaceable events (kinds 34235, 34236)
 * - Uses nevent for regular events (kinds 21, 22)
 */
export function encodeVideoEvent(video: VideoEvent, relays?: string[]): string {
  try {
    // Parameterized replaceable events (kinds 30000-39999) use naddr
    if (video.kind === 34235 || video.kind === 34236) {
      // Find the d-tag (identifier) for addressable events
      const dTag = video.metadata[0]?.url || video.id.slice(0, 16);

      return nip19.naddrEncode({
        kind: video.kind,
        pubkey: video.pubkey,
        identifier: dTag,
        relays: relays || [],
      });
    }

    // Regular events (kinds 21, 22) use nevent
    return nip19.neventEncode({
      id: video.id,
      relays: relays || [],
      author: video.pubkey,
      kind: video.kind,
    });
  } catch (error) {
    console.error('Failed to encode video event:', error);
    return video.id; // Fallback to hex ID
  }
}

/**
 * Decode a NIP-19 identifier (naddr, nevent, note, or hex) to get event lookup info
 * Returns the information needed to query for the event
 */
export function decodeVideoIdentifier(identifier: string): {
  type: 'naddr' | 'nevent' | 'note' | 'hex';
  id?: string;
  kind?: number;
  pubkey?: string;
  dTag?: string;
  relays?: string[];
} | null {
  try {
    // Try to decode as NIP-19
    const decoded = nip19.decode(identifier);

    if (decoded.type === 'naddr') {
      const data = decoded.data as { kind: number; pubkey: string; identifier: string; relays?: string[] };
      return {
        type: 'naddr',
        kind: data.kind,
        pubkey: data.pubkey,
        dTag: data.identifier,
        relays: data.relays,
      };
    }

    if (decoded.type === 'nevent') {
      const data = decoded.data as { id: string; relays?: string[]; author?: string; kind?: number };
      return {
        type: 'nevent',
        id: data.id,
        kind: data.kind,
        pubkey: data.author,
        relays: data.relays,
      };
    }

    if (decoded.type === 'note') {
      return {
        type: 'note',
        id: decoded.data as string,
      };
    }
  } catch (error) {
    // Not a valid NIP-19 identifier, assume it's a hex event ID
    if (/^[0-9a-f]{64}$/i.test(identifier)) {
      return {
        type: 'hex',
        id: identifier,
      };
    }
  }

  return null;
}
