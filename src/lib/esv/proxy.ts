import "server-only";
import { validatePassageRequest, type ParsedPassage } from "@/lib/bible/reference";
import { ESV_AUDIO_ENDPOINT, ESV_TEXT_ENDPOINT, getEsvApiKey } from "./config";
import { tryConsume } from "./rateLimit";
import { jsonNoStore, NO_STORE_HEADERS } from "./responses";
import { ESV_NOTICE } from "./notice";


/** Shared gate: validate the reference, check config, enforce rate limits. */
type GateResult =
  | { kind: "error"; response: Response }
  | { kind: "ok"; passage: ParsedPassage; key: string };

function gate(req: Request): GateResult {
  const ref = new URL(req.url).searchParams.get("ref") ?? "";
  const v = validatePassageRequest(ref);
  if (!v.ok) return { kind: "error", response: jsonNoStore({ error: "invalid_reference", message: v.error }, 400) };
  const key = getEsvApiKey();
  if (!key) {
    return {
      kind: "error",
      response: jsonNoStore(
        { error: "not_configured", message: "ESV API key not configured. Set ESV_API_KEY in the server environment." },
        503,
      ),
    };
  }
  const rl = tryConsume();
  if (!rl.ok) {
    return {
      kind: "error",
      response: jsonNoStore({ error: "rate_limited", message: "Too many requests. Please try again shortly." }, 429, {
        "Retry-After": String(rl.retryAfterSec),
      }),
    };
  }
  return { kind: "ok", passage: v.passage, key };
}

export type EsvTextResult =
  | { ok: true; canonical: string; passages: string[] }
  | { ok: false; status: number; body: { error: string; message: string; status?: number } };

/** Fetch one already-validated passage live from the ESV text endpoint. Nothing is persisted. */
export async function fetchEsvText(passage: ParsedPassage, key: string): Promise<EsvTextResult> {
  const params = new URLSearchParams({
    q: passage.esvQuery,
    "include-passage-references": "false",
    "include-verse-numbers": "true",
    "include-first-verse-numbers": "true",
    "include-footnotes": "false",
    "include-footnote-body": "false",
    "include-headings": "true",
    // Keep Crossway's "(ESV)" marker on every quotation, as their terms require.
    "include-short-copyright": "true",
    "include-copyright": "false",
    "indent-paragraphs": "0",
    "indent-poetry": "true",
  });
  let upstream: Response;
  try {
    upstream = await fetch(`${ESV_TEXT_ENDPOINT}?${params}`, {
      headers: { Authorization: `Token ${key}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 502, body: { error: "upstream_unreachable", message: "Could not reach the ESV API." } };
  }
  if (!upstream.ok) {
    return {
      ok: false,
      status: 502,
      body: { error: "upstream_error", status: upstream.status, message: upstreamMessage(upstream.status) },
    };
  }
  const data = (await upstream.json()) as { canonical?: string; passages?: string[] };
  return {
    ok: true,
    canonical: data.canonical ?? passage.display,
    passages: Array.isArray(data.passages) ? data.passages : [],
  };
}

/** GET /api/esv/text?ref=John+1:1-5 — live passage text, never cached or stored. */
export async function handleTextRequest(req: Request): Promise<Response> {
  const g = gate(req);
  if (g.kind === "error") return g.response;
  const r = await fetchEsvText(g.passage, g.key);
  if (!r.ok) return jsonNoStore(r.body, r.status);
  // Only the fields the UI needs are relayed; nothing is persisted.
  return jsonNoStore({
    reference: g.passage.display,
    canonical: r.canonical,
    verseCount: g.passage.verseCount,
    passages: r.passages,
    copyright: ESV_NOTICE,
  });
}

/**
 * GET /api/esv/audio?ref=John+1:1-5 — live official ESV audio.
 * The ESV API answers with a redirect to an MP3. We resolve that redirect server-side
 * (so the API key never leaves the server) and stream the bytes straight through to the
 * browser without buffering to disk or memory, with Cache-Control: no-store.
 */
export async function handleAudioRequest(req: Request): Promise<Response> {
  const g = gate(req);
  if (g.kind === "error") return g.response;
  const apiUrl = `${ESV_AUDIO_ENDPOINT}?${new URLSearchParams({ q: g.passage.esvQuery })}`;
  try {
    let upstream = await fetch(apiUrl, {
      headers: { Authorization: `Token ${g.key}` },
      redirect: "manual",
      cache: "no-store",
    });
    // Follow the redirect ourselves WITHOUT the Authorization header (it is only for api.esv.org).
    for (let hops = 0; hops < 5 && upstream.status >= 300 && upstream.status < 400; hops++) {
      const location = upstream.headers.get("location");
      if (!location) break;
      const next = new URL(location, apiUrl);
      if (next.protocol !== "https:") break;
      const headers: Record<string, string> = {};
      const range = req.headers.get("range");
      if (range && /^bytes=\d*-\d*$/.test(range)) headers.Range = range;
      upstream = await fetch(next, { headers, redirect: "manual", cache: "no-store" });
    }
    if (!(upstream.ok || upstream.status === 206) || !upstream.body) {
      return jsonNoStore({ error: "upstream_error", status: upstream.status, message: upstreamMessage(upstream.status) }, 502);
    }
    const headers: Record<string, string> = {
      ...NO_STORE_HEADERS,
      "Content-Type": upstream.headers.get("content-type") ?? "audio/mpeg",
      // Play inline only; discourage "save as" downloads.
      "Content-Disposition": "inline",
    };
    for (const h of ["content-length", "content-range", "accept-ranges"]) {
      const val = upstream.headers.get(h);
      if (val) headers[h] = val;
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return jsonNoStore({ error: "upstream_unreachable", message: "Could not reach the ESV audio service." }, 502);
  }
}

/** GET /api/esv/status — tells the UI whether a key is configured. Never reveals the key itself. */
export function handleStatusRequest(): Response {
  return jsonNoStore({ configured: Boolean(getEsvApiKey()) });
}

function upstreamMessage(status: number): string {
  if (status === 401 || status === 403) return "The ESV API rejected the server's credentials.";
  if (status === 429) return "The ESV API is throttling requests. Please try again later.";
  return "The ESV API returned an error.";
}
