import "server-only";

/**
 * The ESV API key is read ONLY from the server-side environment.
 * It is never prefixed with NEXT_PUBLIC_, never returned in a response, and never logged.
 */
export function getEsvApiKey(): string | undefined {
  const key = process.env.ESV_API_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

export const ESV_TEXT_ENDPOINT = "https://api.esv.org/v3/passage/text/";
export const ESV_AUDIO_ENDPOINT = "https://api.esv.org/v3/passage/audio/";
