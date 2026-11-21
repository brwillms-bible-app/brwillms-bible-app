import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handlePassageRequest } from "@/lib/scripture/passageRoute";
import { resetRateLimit } from "@/lib/esv/rateLimit";
import { ESV_NOTICE } from "@/lib/esv/notice";

const SECRET = "sk_test_PASSAGE_ROUTE_SECRET_987";
const req = (ref: string) => new Request(`http://x/api/passage?ref=${encodeURIComponent(ref)}`);

describe("/api/passage (provider-agnostic proxy)", () => {
  beforeEach(() => {
    resetRateLimit();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("defaults to the BSB stub: Genesis 12:1-9 with no key and no network", async () => {
    vi.stubEnv("SCRIPTURE_PROVIDER", "");
    vi.stubEnv("ESV_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await handlePassageRequest(req("Genesis 12:1-9"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.json();
    expect(body.provider.id).toBe("bsb");
    expect(body.provider.notice).toBeUndefined();
    expect(body.stub).toBe(true);
    expect(body.reference).toBe("Genesis 12:1-9");
    expect(body.verses).toHaveLength(9);
    expect(body.verses[0].number).toBe(1);
    expect(body.verses[0].text).toMatch(/Abram/);
    expect(body.verses.some((v: { text: string }) => v.text.includes("Placeholder"))).toBe(false);
    expect(body.audio).toEqual({ url: null, comingSoon: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("BSB stub marks references outside Genesis 12:1-9 as placeholders", async () => {
    const body = await (await handlePassageRequest(req("John 1:1-2"))).json();
    expect(body.verses).toEqual([
      { number: 1, text: "[Placeholder — BSB text for John 1:1 coming soon]" },
      { number: 2, text: "[Placeholder — BSB text for John 1:2 coming soon]" },
    ]);
  });

  it("applies the request limits to every provider", async () => {
    for (const ref of ["Psalm 1-50", "Jude 1-13", "Genesis 1:1; Genesis 2:1", "nonsense"]) {
      expect((await handlePassageRequest(req(ref))).status).toBe(400);
    }
  });

  it("ESV selected by env without a key -> clear not_configured state", async () => {
    vi.stubEnv("SCRIPTURE_PROVIDER", "esv");
    vi.stubEnv("ESV_API_KEY", "");
    const res = await handlePassageRequest(req("Genesis 12:1-9"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("not_configured");
    expect(body.provider.notice).toBe(ESV_NOTICE);
  });

  it("ESV selected with a key: live fetch, notice attached, key never in response, audio via proxy", async () => {
    vi.stubEnv("SCRIPTURE_PROVIDER", "esv");
    vi.stubEnv("ESV_API_KEY", SECRET);
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ canonical: "Genesis 12:1–9", passages: ["[1] ... (ESV)"] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const res = await handlePassageRequest(req("Genesis 12:1-9"));
    expect(res.status).toBe(200);
    const text = await res.clone().text();
    expect(text).not.toContain(SECRET);
    expect(JSON.stringify([...res.headers.entries()])).not.toContain(SECRET);
    const body = await res.json();
    expect(body.provider.id).toBe("esv");
    expect(body.provider.notice).toBe(ESV_NOTICE);
    expect(body.stub).toBe(false);
    expect(body.audio.url).toBe("/api/esv/audio?ref=Genesis%2012%3A1-9");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(String((fetchSpy.mock.calls[0] as unknown[])[0])).toContain("q=01012001-01012009");
  });
});
