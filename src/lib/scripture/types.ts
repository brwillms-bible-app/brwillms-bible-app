import type { ParsedPassage } from "@/lib/bible/reference";

/**
 * Pluggable Scripture provider. The app talks only to /api/passage, which picks the active
 * provider from the SCRIPTURE_PROVIDER env var (default "bsb").
 *
 *  - "bsb": Berean Standard Bible STUB (public domain). Ships Genesis 12:1-9 only; other
 *           references return clearly marked placeholder text. Audio: "coming soon".
 *  - "esv": Crossway ESV API (optional). Live-only, never cached, strict request limits,
 *           mandatory copyright notice. Requires ESV_API_KEY on the server.
 *
 * To add a real BSB provider later, implement this interface and register it in ./registry.ts.
 */
export interface PassageVerse {
  number: number;
  text: string;
}

export interface PassageAudio {
  /** Same-origin URL to stream, or null when audio is not available yet. */
  url: string | null;
  comingSoon: boolean;
}

export interface PassageResult {
  reference: string;
  /** True when the content is placeholder/stub data rather than a full live provider. */
  stub: boolean;
  /** Structured verses (stub/BSB). */
  verses?: PassageVerse[];
  /** Pre-formatted passage blocks exactly as returned by the provider (ESV). */
  passages?: string[];
  audio: PassageAudio;
}

export interface ProviderError {
  error: string;
  message: string;
  /** HTTP status for the proxy response. */
  status: number;
}

export interface ProviderInfo {
  id: string;
  name: string;
  /** Copyright/attribution notice that MUST be rendered wherever this provider's text/audio is shown. */
  notice?: string;
  /** Short attribution shown when no formal notice is required. */
  attribution?: string;
}

export interface ScriptureProvider extends ProviderInfo {
  /** Whether the provider can serve requests now (e.g. key present). Never exposes secrets. */
  isConfigured(): boolean;
  /** Fetch one passage that has ALREADY passed validatePassageRequest(). */
  getPassage(passage: ParsedPassage): Promise<PassageResult | ProviderError>;
}

export function isProviderError(r: PassageResult | ProviderError): r is ProviderError {
  return "error" in r;
}
