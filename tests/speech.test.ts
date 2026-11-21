import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { audioEntries, audioMap, findAudioEntry, isSafeAudioFilePath, MAX_TTS_CHARS } from "@/lib/speech/audioMap";
import { bsbTextLength, handleSpeechRequest } from "@/lib/speech/speechRoute";
import { parseReference } from "@/lib/bible/reference";

const SECRET = "sk_test_ELEVENLABS_SERVER_KEY_DO_NOT_LEAK";
const VOICE = "voice_NARRATOR_PLACEHOLDER";
const root = path.resolve(__dirname, "..");

const req = (ref: string, extra: Record<string, string> = {}) => {
  const u = new URL("http://x/api/speech");
  if (ref) u.searchParams.set("ref", ref);
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
  return new Request(u);
};

async function dump(res: Response) {
  return JSON.stringify([...res.headers.entries()]) + (await res.clone().text());
}

describe("audio map", () => {
  it("follows the artwork-mapping pattern: valid refs, BSB-only TTS, safe file paths", () => {
    expect(audioMap.voices.narrator.voiceEnv).toBe("ELEVENLABS_VOICE_NARRATOR");
    expect(audioMap.voices.jesus.voiceEnv).toBe("ELEVENLABS_VOICE_JESUS");
    expect(audioMap.voices.peter.voiceEnv).toBe("ELEVENLABS_VOICE_PETER");
    expect(audioEntries.length).toBeGreaterThanOrEqual(2);

    const john = audioEntries.find((e) => e.id === "john-21-voice-test");
    expect(john).toMatchObject({ kind: "file", passage: "John 21:1-25", file: "/audio/john-21-voice-test.mp3" });
    const gen = audioEntries.find((e) => e.id === "genesis-12");
    expect(gen).toMatchObject({ kind: "tts", passage: "Genesis 12:1-9", translation: "bsb" });

    for (const entry of audioEntries) {
      expect(parseReference(entry.passage).ok, entry.passage).toBe(true);
      if (entry.kind === "file") {
        expect(isSafeAudioFilePath(entry.file), entry.file).toBe(true);
      } else {
        expect(entry.translation).toBe("bsb");
        expect(entry.speakers.length).toBeGreaterThan(0);
        for (const role of entry.speakers) {
          expect(audioMap.voices[role]?.voiceEnv).toMatch(/^ELEVENLABS_VOICE_/);
        }
      }
    }
  });

  it("matches Genesis 12 and John 21 aliases, and the expected recording is still missing", () => {
    expect(findAudioEntry("Genesis 12")?.entry.id).toBe("genesis-12");
    expect(findAudioEntry("Genesis 12:1-9")?.entry.id).toBe("genesis-12");
    expect(findAudioEntry("John 21")?.entry.id).toBe("john-21-voice-test");
    expect(findAudioEntry("John 21:1-25")?.entry.id).toBe("john-21-voice-test");
    expect(findAudioEntry("Psalm 23")).toBeUndefined();
    const john = audioEntries.find((e) => e.kind === "file" && e.id === "john-21-voice-test");
    expect(john && john.kind === "file" && fs.existsSync(path.join(root, "public", john.file.slice(1)))).toBe(false);
  });
});

describe("/api/speech", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects unknown and invalid references before any upstream call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("ELEVENLABS_API_KEY", SECRET);
    for (const ref of ["Psalm 23", "Hezekiah 1:1", "John 22:1", "nonsense", ""]) {
      const res = await handleSpeechRequest(req(ref));
      expect(res.status, ref).toBeGreaterThanOrEqual(400);
      expect([400, 404]).toContain(res.status);
      const body = await res.json();
      expect(["unknown_reference", "invalid_reference"]).toContain(body.error);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 501 when the Genesis 12 TTS entry has no API key, and does not call ElevenLabs", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    vi.stubEnv("ELEVENLABS_VOICE_NARRATOR", VOICE);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await handleSpeechRequest(req("Genesis 12"));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toBe("not_configured");
    expect(body.message).toMatch(/ELEVENLABS_API_KEY/);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 501 when the narrator voice ID env var is missing", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", SECRET);
    vi.stubEnv("ELEVENLABS_VOICE_NARRATOR", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await handleSpeechRequest(req("Genesis 12:1-9"));
    expect(res.status).toBe(501);
    expect((await res.json()).message).toMatch(/ELEVENLABS_VOICE_NARRATOR/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses ESV and arbitrary text, and never caches those errors", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const esv = await handleSpeechRequest(req("Genesis 12", { translation: "esv" }));
    expect(esv.status).toBe(400);
    expect((await esv.json()).error).toBe("unsupported_translation");
    const raw = await handleSpeechRequest(new Request("http://x/api/speech?ref=Genesis+12&text=hello"));
    expect(raw.status).toBe(400);
    expect((await raw.json()).error).toBe("invalid_request");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 404 for the mapped John 21 file until the recording is added (no API key needed)", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await handleSpeechRequest(req("John 21:1-25"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("missing_file");
    expect(body.message).toMatch(/john-21-voice-test\.mp3/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("synthesizes bundled BSB text only, sends the key only upstream, and allows BSB cache headers", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", SECRET);
    vi.stubEnv("ELEVENLABS_VOICE_NARRATOR", VOICE);
    const fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`);
      const headers = init!.headers as Record<string, string>;
      expect(headers["xi-api-key"]).toBe(SECRET);
      const body = JSON.parse(String(init!.body));
      expect(body.text).toMatch(/Abram/);
      expect(body.text).not.toMatch(/Placeholder/);
      expect(body.text.length).toBeLessThanOrEqual(MAX_TTS_CHARS);
      expect(JSON.stringify(body)).not.toContain(SECRET);
      return new Response(new Uint8Array([0xff, 0xfb, 0x90]), { status: 200, headers: { "content-type": "audio/mpeg" } });
    });
    vi.stubGlobal("fetch", fetchSpy);
    const res = await handleSpeechRequest(req("Genesis 12"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(res.headers.get("cache-control")).toMatch(/public/);
    expect(await dump(res)).not.toContain(SECRET);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xfb, 0x90]));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not leak the key when the speech service errors", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", SECRET);
    vi.stubEnv("ELEVENLABS_VOICE_NARRATOR", VOICE);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`bad key ${SECRET}`, { status: 401 })));
    const res = await handleSpeechRequest(req("Genesis 12:1-9"));
    expect(res.status).toBe(502);
    expect(await dump(res)).not.toContain(SECRET);
  });

  it("keeps Genesis 12 BSB text under the TTS character cap", () => {
    const n = bsbTextLength("Genesis 12:1-9");
    expect(n).toBeGreaterThan(100);
    expect(n).toBeLessThanOrEqual(MAX_TTS_CHARS);
  });
});
