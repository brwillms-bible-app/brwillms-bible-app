import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleAudioRequest, handleStatusRequest, handleTextRequest } from "@/lib/esv/proxy";
import { resetRateLimit, tryConsume } from "@/lib/esv/rateLimit";
import { ESV_NOTICE } from "@/lib/esv/notice";

const SECRET = "sk_test_SUPER_SECRET_ESV_KEY_123456";

async function dump(res: Response) {
  const headers = JSON.stringify([...res.headers.entries()]);
  const body = await res.clone().text();
  return headers + body;
}

describe("ESV proxy", () => {
  beforeEach(() => {
    resetRateLimit();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns a clear not_configured state with no key, without calling the API", async () => {
    vi.stubEnv("ESV_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await handleTextRequest(new Request("http://x/api/esv/text?ref=John+1:1-5"));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("not_configured");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await (handleStatusRequest()).json()).toEqual({ configured: false });
  });

  it("sends the key ONLY in the upstream Authorization header and never in the response", async () => {
    vi.stubEnv("ESV_API_KEY", SECRET);
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ canonical: "John 1:1–5", passages: ["[1] In the beginning ... (ESV)"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const res = await handleTextRequest(new Request("http://x/api/esv/text?ref=John+1:1-5"));
    expect(res.status).toBe(200);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/api\.esv\.org\/v3\/passage\/text\/\?/);
    expect(String(url)).toContain("q=43001001-43001005");
    expect(String(url)).not.toContain(SECRET);
    expect((init!.headers as Record<string, string>).Authorization).toBe(`Token ${SECRET}`);
    expect(init!.cache).toBe("no-store");
    const all = await dump(res);
    expect(all).not.toContain(SECRET);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.json();
    expect(body.copyright).toBe(ESV_NOTICE);
    expect(await (handleStatusRequest()).text()).not.toContain(SECRET);
    expect(await (handleStatusRequest()).json()).toEqual({ configured: true });
  });

  it("does not leak the key when upstream errors", async () => {
    vi.stubEnv("ESV_API_KEY", SECRET);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`bad token ${SECRET}`, { status: 401 })));
    const res = await handleTextRequest(new Request("http://x/api/esv/text?ref=John+1:1"));
    expect(res.status).toBe(502);
    expect(await dump(res)).not.toContain(SECRET);
  });

  it("rejects over-limit references before any upstream call", async () => {
    vi.stubEnv("ESV_API_KEY", SECRET);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (const ref of ["Psalm 1-50", "Jude 1-13", "Genesis 1-50", "John 1:1; John 3:16", ""]) {
      const r1 = await handleTextRequest(new Request(`http://x/api/esv/text?ref=${encodeURIComponent(ref)}`));
      const r2 = await handleAudioRequest(new Request(`http://x/api/esv/audio?ref=${encodeURIComponent(ref)}`));
      expect(r1.status).toBe(400);
      expect(r2.status).toBe(400);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("audio: resolves the redirect server-side, drops the key on the CDN hop, streams with no-store", async () => {
    vi.stubEnv("ESV_API_KEY", SECRET);
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        if (String(url).startsWith("https://api.esv.org/")) {
          return new Response(null, { status: 302, headers: { location: "https://audio.esv.org/hw/43001001-43001005.mp3" } });
        }
        return new Response(new Uint8Array([0xff, 0xfb, 0x90]), { status: 200, headers: { "content-type": "audio/mpeg", "content-length": "3" } });
      }),
    );
    const res = await handleAudioRequest(new Request("http://x/api/esv/audio?ref=John+1:1-5", { headers: { range: "bytes=0-" } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("location")).toBeNull();
    expect((calls[0].init!.headers as Record<string, string>).Authorization).toBe(`Token ${SECRET}`);
    expect(JSON.stringify(calls[1].init!.headers)).not.toContain(SECRET);
    expect((calls[1].init!.headers as Record<string, string>).Range).toBe("bytes=0-");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xfb, 0x90]));
  });

  it("rate limiter mirrors Crossway's 60/minute cap", () => {
    resetRateLimit();
    const t = 1_000_000;
    for (let i = 0; i < 60; i++) expect(tryConsume(t + i).ok).toBe(true);
    expect(tryConsume(t + 61).ok).toBe(false);
    expect(tryConsume(t + 61_000).ok).toBe(true);
  });
});
