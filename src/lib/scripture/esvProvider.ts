import "server-only";
import type { ScriptureProvider } from "./types";
import { getEsvApiKey } from "@/lib/esv/config";
import { fetchEsvText } from "@/lib/esv/proxy";
import { tryConsume } from "@/lib/esv/rateLimit";
import { ESV_NOTICE } from "@/lib/esv/notice";

/**
 * Optional ESV provider (SCRIPTURE_PROVIDER=esv). All Crossway rules apply:
 * live-only (no caching/storage), <500 verses and < half a book per request (enforced before
 * this is called), rate limits, key server-side only, and the mandatory notice.
 */
export const esvProvider: ScriptureProvider = {
  id: "esv",
  name: "English Standard Version",
  notice: ESV_NOTICE,
  isConfigured: () => Boolean(getEsvApiKey()),
  async getPassage(p) {
    const key = getEsvApiKey();
    if (!key) {
      return {
        error: "not_configured",
        message: "ESV API key not configured. Set ESV_API_KEY in the server environment.",
        status: 503,
      };
    }
    const rl = tryConsume();
    if (!rl.ok) return { error: "rate_limited", message: "Too many requests. Please try again shortly.", status: 429 };
    const r = await fetchEsvText(p, key);
    if (!r.ok) return { error: r.body.error, message: r.body.message, status: r.status };
    return {
      reference: r.canonical,
      stub: false,
      passages: r.passages,
      // Streams live through our audio proxy (redirect resolved server-side, never stored).
      audio: { url: `/api/esv/audio?ref=${encodeURIComponent(p.display)}`, comingSoon: false },
    };
  },
};
