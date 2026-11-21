import "server-only";
import { validatePassageRequest } from "@/lib/bible/reference";
import { jsonNoStore } from "@/lib/esv/responses";
import { getActiveProvider, providerInfo } from "./registry";
import { isProviderError } from "./types";

/**
 * GET /api/passage?ref=Genesis+12:1-9
 * One server-side proxy for every provider. Every request is validated against the Crossway
 * limits (<500 verses AND < half a book) regardless of provider, and every response is no-store.
 */
export async function handlePassageRequest(req: Request): Promise<Response> {
  const ref = new URL(req.url).searchParams.get("ref") ?? "";
  const v = validatePassageRequest(ref);
  if (!v.ok) return jsonNoStore({ error: "invalid_reference", message: v.error }, 400);
  const provider = getActiveProvider();
  const info = providerInfo(provider);
  const result = await provider.getPassage(v.passage);
  if (isProviderError(result)) {
    return jsonNoStore({ error: result.error, message: result.message, provider: info }, result.status);
  }
  return jsonNoStore({ provider: info, verseCount: v.passage.verseCount, ...result });
}
