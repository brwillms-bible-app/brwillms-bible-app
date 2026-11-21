import "server-only";
import fs from "node:fs";
import path from "node:path";
import genesis12 from "@/data/bsb-stub/genesis-12.json";
import { parseReference, validatePassageRequest, type ParsedPassage } from "@/lib/bible/reference";
import { jsonNoStore } from "@/lib/esv/responses";
import {
  findAudioEntry,
  isSafeAudioFilePath,
  MAX_TTS_CHARS,
  type SpeechSegment,
  type TtsAudioEntry,
  type TtsSegmentsEntry,
} from "./audioMap";
import { resolveVoice } from "./voices";

const BSB_CACHE = "public, max-age=3600, s-maxage=86400";
const TTS_MODEL = "eleven_multilingual_v2";

function envValue(name: string): string {
  return (process.env[name] ?? "").trim();
}

function bsbVersesFor(passage: ParsedPassage): { ok: true; text: string } | { ok: false; error: string } {
  const parts: string[] = [];
  for (let c = passage.startChapter; c <= passage.endChapter; c++) {
    const first = c === passage.startChapter ? passage.startVerse : 1;
    const last = c === passage.endChapter ? passage.endVerse : passage.book.chapterVerses[c - 1];
    for (let v = first; v <= last; v++) {
      const real =
        passage.book.name === genesis12.book && c === genesis12.chapter
          ? genesis12.verses.find((x) => x.number === v)
          : undefined;
      if (!real?.text) {
        return { ok: false, error: `Bundled BSB text is not available for ${passage.book.name} ${c}:${v}.` };
      }
      parts.push(real.text);
    }
  }
  const text = parts.join(" ");
  if (!text) return { ok: false, error: "No BSB text was found for this passage." };
  if (text.length > MAX_TTS_CHARS) {
    return { ok: false, error: `Passage text is ${text.length} characters; the limit is ${MAX_TTS_CHARS}.` };
  }
  return { ok: true, text };
}

function publicFilePath(file: string): string | undefined {
  if (!isSafeAudioFilePath(file)) return undefined;
  return path.join(process.cwd(), "public", file.slice(1));
}

function missingKeyResponse(): Response {
  return jsonNoStore(
    {
      error: "not_configured",
      message: "ElevenLabs is not configured. Set ELEVENLABS_API_KEY on the server (never in NEXT_PUBLIC_ variables).",
    },
    501,
  );
}

async function elevenLabsMpeg(voiceId: string, text: string, key: string): Promise<Response | Uint8Array> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        "xi-api-key": key,
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, model_id: TTS_MODEL }),
    });
  } catch {
    return jsonNoStore({ error: "upstream_error", message: "Could not reach the speech service." }, 502);
  }
  if (!upstream.ok) {
    return jsonNoStore({ error: "upstream_error", message: "The speech service could not generate audio for this passage." }, 502);
  }
  return new Uint8Array(await upstream.arrayBuffer());
}

function mpegResponse(bytes: Uint8Array): Response {
  // Copied into a fresh ArrayBuffer so the Response body is a clean BufferSource.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Response(copy, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": BSB_CACHE,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Concatenate same-format MP3 byte streams (same ElevenLabs model / output).
 * MP3 is a sequence of frames, so joining the raw payloads plays back as one clip
 * in common players. Joints may have a tiny click; we do not rewrite Xing headers.
 */
export function concatMpeg(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

async function synthesizeBsb(entry: TtsAudioEntry, passage: ParsedPassage): Promise<Response> {
  if (entry.translation !== "bsb") {
    return jsonNoStore({ error: "unsupported_translation", message: "Only BSB text may be synthesized. ESV audio is not available through this route and must never be cached." }, 400);
  }
  const key = envValue("ELEVENLABS_API_KEY");
  if (!key) return missingKeyResponse();

  const speaker = entry.speakers[0] ?? "narrator";
  const voice = resolveVoice(speaker);
  if (!voice.ok) return jsonNoStore({ error: "not_configured", message: voice.error }, 501);

  const body = bsbVersesFor(passage);
  if (!body.ok) return jsonNoStore({ error: "text_unavailable", message: body.error }, 501);

  const audio = await elevenLabsMpeg(voice.voiceId, body.text, key);
  if (audio instanceof Response) return audio;
  return mpegResponse(audio);
}

async function synthesizeSegments(entry: TtsSegmentsEntry): Promise<Response> {
  if (entry.translation !== "bsb") {
    return jsonNoStore({ error: "unsupported_translation", message: "Only BSB text may be synthesized. ESV audio is not available through this route and must never be cached." }, 400);
  }
  const key = envValue("ELEVENLABS_API_KEY");
  if (!key) return missingKeyResponse();
  if (!entry.segments.length) {
    return jsonNoStore({ error: "invalid_mapping", message: "This passage has no speech segments." }, 500);
  }

  const totalChars = entry.segments.reduce((n, s) => n + s.text.length, 0);
  if (totalChars > MAX_TTS_CHARS) {
    return jsonNoStore({ error: "text_too_long", message: `Passage text is ${totalChars} characters; the limit is ${MAX_TTS_CHARS}.` }, 400);
  }

  // Resolve every speaker first so a missing narrator ID 501s before any upstream call.
  const resolved = new Map<string, string>();
  for (const segment of entry.segments) {
    if (resolved.has(segment.speaker)) continue;
    const voice = resolveVoice(segment.speaker);
    if (!voice.ok) return jsonNoStore({ error: "not_configured", message: voice.error }, 501);
    resolved.set(segment.speaker, voice.voiceId);
  }

  // Sequential calls stay under ElevenLabs Free-plan concurrency (max 2).
  const parts: Uint8Array[] = [];
  for (const segment of entry.segments) {
    const voiceId = resolved.get(segment.speaker)!;
    const audio = await elevenLabsMpeg(voiceId, segment.text, key);
    if (audio instanceof Response) return audio;
    parts.push(audio);
  }
  return mpegResponse(concatMpeg(parts));
}

/**
 * GET /api/speech?ref=Genesis+12
 * Looks up a mapped reference (never arbitrary text). Static BSB recordings are redirected;
 * tts-segments entries synthesize each speaker line in its cast voice and return one MP3.
 * ESV is refused and is never cached.
 */
export async function handleSpeechRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref") ?? "";
  const translation = (url.searchParams.get("translation") ?? "bsb").trim().toLowerCase();
  if (translation && translation !== "bsb") {
    return jsonNoStore(
      { error: "unsupported_translation", message: "This route only serves BSB audio. ESV audio must be streamed live through the ESV proxy and must never be cached." },
      400,
    );
  }
  if (url.searchParams.has("text")) {
    return jsonNoStore({ error: "invalid_request", message: "Send a verse reference in `ref`, not raw text." }, 400);
  }

  const validated = validatePassageRequest(ref);
  if (!validated.ok) return jsonNoStore({ error: "invalid_reference", message: validated.error }, 400);

  const found = findAudioEntry(ref);
  if (!found) {
    return jsonNoStore({ error: "unknown_reference", message: `No audio is mapped for ${validated.passage.display}.` }, 404);
  }

  if (found.entry.kind === "file") {
    const file = found.entry.file;
    const abs = publicFilePath(file);
    if (!abs) {
      return jsonNoStore({ error: "invalid_mapping", message: "The mapped audio path is not allowed." }, 500);
    }
    if (!fs.existsSync(abs)) {
      return jsonNoStore(
        {
          error: "missing_file",
          message: `The recording ${file} has not been added yet. Place the John 21 voice-test file at public${file}.`,
        },
        404,
      );
    }
    return Response.redirect(new URL(file, url.origin), 302);
  }

  if (found.entry.kind === "tts-segments") return synthesizeSegments(found.entry);
  return synthesizeBsb(found.entry, found.mapped);
}

/** Re-export parse hook so tests can reuse the cap against the stub text. */
export function bsbTextLength(ref: string): number | undefined {
  const found = findAudioEntry(ref);
  if (found?.entry.kind === "tts-segments") {
    return found.entry.segments.reduce((n, s) => n + s.text.length, 0);
  }
  const parsed = parseReference(ref);
  if (!parsed.ok) return undefined;
  const body = bsbVersesFor(parsed.passage);
  return body.ok ? body.text.length : undefined;
}

export type { SpeechSegment, TtsAudioEntry };
