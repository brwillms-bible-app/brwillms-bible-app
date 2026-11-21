import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  audioEntries,
  findAudioEntry,
  isSafeAudioFilePath,
  joinedStubText,
  MAX_TTS_CHARS,
  reconstructBsbText,
  segmentSpeakers,
} from "@/lib/speech/audioMap";
import { concatMpeg, bsbTextLength, handleSpeechRequest } from "@/lib/speech/speechRoute";
import { parseReference } from "@/lib/bible/reference";
import { resolveVoice, voiceEnvChain, voiceRoles } from "@/lib/speech/voices";

const SECRET = "sk_test_ELEVENLABS_SERVER_KEY_DO_NOT_LEAK";
const VOICE_NARRATOR = "voice_NARRATOR_PLACEHOLDER";
const VOICE_JESUS = "voice_JESUS_PLACEHOLDER";
const VOICE_GOD = "voice_GOD_PLACEHOLDER";
const VOICE_PETER = "voice_PETER_PLACEHOLDER";
const VOICE_ABRAM = "voice_ABRAM_PLACEHOLDER";
const DEFAULT_ROGER = "CwhRBWXzGAHq8TQ4Fs17";
const DEFAULT_KAI = "hfqsl1OMbiWsgPpht3el";
const DEFAULT_BRIAN = "PGoKnSD4gKn2aS99wOR2";
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

function genesisEntry() {
  const entry = audioEntries.find((e) => e.id === "genesis-12");
  expect(entry?.kind).toBe("tts-segments");
  if (!entry || entry.kind !== "tts-segments") throw new Error("genesis-12 missing");
  return entry;
}

describe("audio map", () => {
  it("follows the artwork-mapping pattern: valid refs, BSB-only TTS, safe file paths", () => {
    expect(audioEntries.length).toBeGreaterThanOrEqual(2);

    const john = audioEntries.find((e) => e.id === "john-21-voice-test");
    expect(john).toMatchObject({ kind: "file", passage: "John 21:1-25", file: "/audio/john-21-voice-test.mp3" });
    const gen = genesisEntry();
    expect(gen).toMatchObject({ kind: "tts-segments", passage: "Genesis 12:1-9", translation: "bsb" });
    expect(gen.segments.length).toBe(5);

    for (const entry of audioEntries) {
      expect(parseReference(entry.passage).ok, entry.passage).toBe(true);
      if (entry.kind === "file") {
        expect(isSafeAudioFilePath(entry.file), entry.file).toBe(true);
      } else {
        expect(entry.translation).toBe("bsb");
        for (const role of segmentSpeakers(entry)) {
          expect(voiceEnvChain(role)[voiceEnvChain(role).length - 1]).toBe("ELEVENLABS_VOICE_NARRATOR");
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

describe("Genesis 12 segmentation", () => {
  it("reconstructs the exact bundled BSB wording (quotes restored, speech tags stay with the narrator)", () => {
    const gen = genesisEntry();
    const joined = joinedStubText("Genesis", 12, 1, 9);
    expect(joined).toBeTruthy();
    expect(reconstructBsbText(gen.segments)).toBe(joined);
    // Dialogue omits wrapping quotes in the spoken text; narrator keeps speech tags.
    expect(gen.segments[0]).toMatchObject({ speaker: "narrator", quoted: false, verses: "1" });
    expect(gen.segments[0].text).toBe("Then the LORD said to Abram,");
    expect(gen.segments[1]).toMatchObject({ speaker: "the_lord", quoted: true, verses: "1-3" });
    expect(gen.segments[1].text.startsWith("Leave your country")).toBe(true);
    expect(gen.segments[1].text.includes("\u201c") || gen.segments[1].text.includes("\u201d")).toBe(false);
    expect(gen.segments[3]).toMatchObject({ speaker: "the_lord", quoted: true, verses: "7" });
    expect(gen.segments[3].text).toBe("I will give this land to your offspring.");
    expect(gen.segments.map((s) => s.speaker)).toEqual(["narrator", "the_lord", "narrator", "the_lord", "narrator"]);
    // Scene is 1-9 only; Abram and Pharaoh have no lines here.
    expect(gen.segments.some((s) => s.speaker === "abram" || s.speaker === "pharaoh")).toBe(false);
  });

  it("matches the official BSB file when present", () => {
    const officialPath = "/tmp/bsb/bsb.txt";
    if (!fs.existsSync(officialPath)) return;
    const official: Record<number, string> = {};
    for (const line of fs.readFileSync(officialPath, "utf8").split("\n")) {
      if (!line.startsWith("Genesis 12:")) continue;
      const [ref, text] = line.split("\t");
      official[Number(ref.split(":")[1])] = text.replace(/\r$/, "");
    }
    const joined = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => official[n]).join(" ");
    expect(reconstructBsbText(genesisEntry().segments)).toBe(joined);
  });
});

describe("role-to-voice resolution", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it("documents fallback chains and uses the first set env var", () => {
    expect(voiceEnvChain("narrator")).toEqual(["ELEVENLABS_VOICE_NARRATOR"]);
    expect(voiceEnvChain("the_lord")).toEqual([
      "ELEVENLABS_VOICE_GOD",
      "ELEVENLABS_VOICE_JESUS",
      "ELEVENLABS_VOICE_NARRATOR",
    ]);
    expect(voiceEnvChain("abram")).toEqual([
      "ELEVENLABS_VOICE_ABRAM",
      "ELEVENLABS_VOICE_PETER",
      "ELEVENLABS_VOICE_NARRATOR",
    ]);
    expect(voiceEnvChain("pharaoh")).toEqual(["ELEVENLABS_VOICE_PHARAOH", "ELEVENLABS_VOICE_NARRATOR"]);
    expect(voiceEnvChain("unknown_role")).toEqual(["ELEVENLABS_VOICE_NARRATOR"]);
  });

  it("uses baked-in Roger, Kai, and Brian IDs when env vars are unset", () => {
    expect(voiceRoles.narrator.defaultVoiceId).toBe(DEFAULT_ROGER);
    expect(voiceRoles.jesus.defaultVoiceId).toBe(DEFAULT_KAI);
    expect(voiceRoles.peter.defaultVoiceId).toBe(DEFAULT_BRIAN);
    expect(voiceRoles.peter.todo).toBeUndefined();
    expect(resolveVoice("narrator")).toEqual({
      ok: true, role: "narrator", voiceId: DEFAULT_ROGER, fromEnv: "ELEVENLABS_VOICE_NARRATOR", source: "default",
    });
    expect(resolveVoice("the_lord")).toEqual({
      ok: true, role: "the_lord", voiceId: DEFAULT_KAI, fromEnv: "ELEVENLABS_VOICE_JESUS", source: "default",
    });
    expect(resolveVoice("jesus")).toMatchObject({ voiceId: DEFAULT_KAI, source: "default" });
    expect(resolveVoice("peter")).toMatchObject({ voiceId: DEFAULT_BRIAN, fromEnv: "ELEVENLABS_VOICE_PETER", source: "default" });
    expect(resolveVoice("abram")).toMatchObject({ voiceId: DEFAULT_BRIAN, fromEnv: "ELEVENLABS_VOICE_PETER", source: "default" });
    expect(resolveVoice("pharaoh")).toMatchObject({ voiceId: DEFAULT_ROGER, fromEnv: "ELEVENLABS_VOICE_NARRATOR", source: "default" });
  });

  it("lets env vars override defaults: GOD -> JESUS -> NARRATOR", () => {
    vi.stubEnv("ELEVENLABS_VOICE_GOD", VOICE_GOD);
    vi.stubEnv("ELEVENLABS_VOICE_JESUS", VOICE_JESUS);
    vi.stubEnv("ELEVENLABS_VOICE_NARRATOR", VOICE_NARRATOR);
    expect(resolveVoice("the_lord")).toEqual({
      ok: true, role: "the_lord", voiceId: VOICE_GOD, fromEnv: "ELEVENLABS_VOICE_GOD", source: "env",
    });

    vi.stubEnv("ELEVENLABS_VOICE_GOD", "");
    expect(resolveVoice("the_lord")).toEqual({
      ok: true, role: "the_lord", voiceId: VOICE_JESUS, fromEnv: "ELEVENLABS_VOICE_JESUS", source: "env",
    });

    vi.stubEnv("ELEVENLABS_VOICE_JESUS", "");
    // No JESUS env, so Kai's baked-in default is used before narrator.
    expect(resolveVoice("the_lord")).toEqual({
      ok: true, role: "the_lord", voiceId: DEFAULT_KAI, fromEnv: "ELEVENLABS_VOICE_JESUS", source: "default",
    });
  });

  it("lets ABRAM and PETER env vars override Brian's default, and PHARAOH fall back to Roger", () => {
    vi.stubEnv("ELEVENLABS_VOICE_NARRATOR", VOICE_NARRATOR);
    vi.stubEnv("ELEVENLABS_VOICE_PETER", VOICE_PETER);
    vi.stubEnv("ELEVENLABS_VOICE_ABRAM", "");
    vi.stubEnv("ELEVENLABS_VOICE_PHARAOH", "");
    expect(resolveVoice("abram")).toMatchObject({ voiceId: VOICE_PETER, fromEnv: "ELEVENLABS_VOICE_PETER", source: "env" });
    vi.stubEnv("ELEVENLABS_VOICE_ABRAM", VOICE_ABRAM);
    expect(resolveVoice("abram")).toMatchObject({ voiceId: VOICE_ABRAM, fromEnv: "ELEVENLABS_VOICE_ABRAM", source: "env" });
    expect(resolveVoice("pharaoh")).toMatchObject({ voiceId: VOICE_NARRATOR, fromEnv: "ELEVENLABS_VOICE_NARRATOR", source: "env" });
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
    vi.stubEnv("ELEVENLABS_VOICE_NARRATOR", VOICE_NARRATOR);
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

  it("uses baked-in Roger and Kai IDs when voice env vars are unset (only the API key is required)", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", SECRET);
    vi.stubEnv("ELEVENLABS_VOICE_NARRATOR", "");
    vi.stubEnv("ELEVENLABS_VOICE_JESUS", "");
    vi.stubEnv("ELEVENLABS_VOICE_GOD", "");
    const gen = genesisEntry();
    const fetchSpy = vi.fn(async (url: string) => {
      const index = fetchSpy.mock.calls.length - 1;
      const segment = gen.segments[index];
      const expected = segment.speaker === "the_lord" ? DEFAULT_KAI : DEFAULT_ROGER;
      expect(String(url)).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${expected}`);
      return new Response(new Uint8Array([0xff, 0xfb, 1]), { status: 200, headers: { "content-type": "audio/mpeg" } });
    });
    vi.stubGlobal("fetch", fetchSpy);
    const res = await handleSpeechRequest(req("Genesis 12:1-9"));
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(5);
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

  it("synthesizes each Genesis 12 segment with the resolved voice and concatenates the MP3s", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", SECRET);
    vi.stubEnv("ELEVENLABS_VOICE_NARRATOR", VOICE_NARRATOR);
    vi.stubEnv("ELEVENLABS_VOICE_JESUS", VOICE_JESUS);
    vi.stubEnv("ELEVENLABS_VOICE_GOD", "");
    const gen = genesisEntry();
    const chunks = gen.segments.map((_, i) => new Uint8Array([0xff, 0xfb, i + 1]));
    let index = 0;
    const fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
      const segment = gen.segments[index];
      const expectedVoice = segment.speaker === "the_lord" ? VOICE_JESUS : VOICE_NARRATOR;
      expect(String(url)).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${expectedVoice}`);
      const headers = init!.headers as Record<string, string>;
      expect(headers["xi-api-key"]).toBe(SECRET);
      const body = JSON.parse(String(init!.body));
      expect(body.text).toBe(segment.text);
      expect(body.text).not.toMatch(/Placeholder/);
      expect(JSON.stringify(body)).not.toContain(SECRET);
      return new Response(chunks[index++], { status: 200, headers: { "content-type": "audio/mpeg" } });
    });
    vi.stubGlobal("fetch", fetchSpy);
    const res = await handleSpeechRequest(req("Genesis 12"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(res.headers.get("cache-control")).toMatch(/public/);
    expect(await dump(res)).not.toContain(SECRET);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(concatMpeg(chunks));
    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  it("does not leak the key when the speech service errors", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", SECRET);
    vi.stubEnv("ELEVENLABS_VOICE_NARRATOR", VOICE_NARRATOR);
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
