import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import scenes from "@/data/scenes.json";
import { objectives, routes } from "@/lib/content";
import { validatePassageRequest } from "@/lib/bible/reference";
import { ESV_NOTICE } from "@/lib/esv/notice";

const root = path.resolve(__dirname, "..");
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}
const srcFiles = walk(path.join(root, "src"));
const clientFiles = srcFiles.filter((f) => /\.(tsx?|jsx?)$/.test(f) && fs.readFileSync(f, "utf8").includes('"use client"'));

describe("compliance guards", () => {
  it("notice text is exactly Crossway's required wording", () => {
    expect(ESV_NOTICE).toBe(
      "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved. https://www.esv.org",
    );
  });

  it("scenes contain only references/artwork/timing — no text fields", () => {
    const allowed = new Set(["id", "book", "title", "passage", "image", "duration", "mapId", "objectiveId", "mapRoute"]);
    for (const s of scenes.scenes) {
      for (const k of Object.keys(s)) expect(allowed.has(k), `unexpected key ${k}`).toBe(true);
      expect(validatePassageRequest(s.passage).ok, s.passage).toBe(true);
      expect(s.duration).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(root, "public", s.image)), s.image).toBe(true);
      const sc = s as { objectiveId?: string; mapRoute?: string };
      if (sc.objectiveId) expect(objectives[sc.objectiveId], sc.objectiveId).toBeTruthy();
      if (sc.mapRoute) expect(routes[sc.mapRoute], sc.mapRoute).toBeTruthy();
    }
  });

  it("no client-side persistence APIs or service workers anywhere in src", () => {
    for (const f of srcFiles) {
      const code = fs.readFileSync(f, "utf8");
      expect(code, f).not.toMatch(/localStorage|sessionStorage|indexedDB|caches\.open|serviceWorker/);
    }
    expect(fs.readdirSync(path.join(root, "public")).some((f) => /sw\.js|service-worker/.test(f))).toBe(false);
  });

  it("client components never touch the key or server ESV modules", () => {
    expect(clientFiles.length).toBeGreaterThan(0);
    for (const f of clientFiles) {
      const code = fs.readFileSync(f, "utf8");
      expect(code, f).not.toMatch(/process\.env\.ESV|process\.env\.ELEVENLABS|@\/lib\/esv\/(config|proxy)|@\/lib\/speech\/speechRoute|api\.esv\.org|api\.elevenlabs\.io/);
    }
    for (const f of srcFiles) expect(fs.readFileSync(f, "utf8"), f).not.toMatch(/NEXT_PUBLIC_ESV|NEXT_PUBLIC_ELEVENLABS/);
  });

  it("no TTS / speech synthesis and no monetization hooks", () => {
    for (const f of srcFiles) {
      const code = fs.readFileSync(f, "utf8");
      expect(code, f).not.toMatch(/speechSynthesis|SpeechSynthesisUtterance|stripe|adsbygoogle|paypal|subscribe now/i);
    }
  });

  it("committed audio may only be public-domain files under public/audio (never ESV)", () => {
    const all = walk(path.join(root, "public")).concat(srcFiles);
    const audio = all.filter((f) => /\.(mp3|m4a|wav|ogg)$/i.test(f));
    for (const f of audio) {
      const rel = path.relative(root, f);
      expect(rel.startsWith("public/audio/"), rel).toBe(true);
      expect(rel, rel).not.toMatch(/esv/i);
    }
  });

  it("Genesis 12 scene matches the first-deliverable spec", () => {
    const g = scenes.scenes.find((x) => x.passage === "Genesis 12:1-9") as Record<string, unknown>;
    expect(g).toMatchObject({ image: "/art/genesis-12.jpg", objectiveId: "gen12-trust-obey", mapRoute: "haran-to-shechem" });
    expect(objectives["gen12-trust-obey"].text).toBe(
      "God calls Abram to trust and obey, with a promise of blessing for all nations",
    );
    const r = routes["haran-to-shechem"];
    expect(r.path[0]).toEqual([39.03, 36.87]);
    expect(r.path[r.path.length - 1]).toEqual([35.28, 32.21]);
  });

  it("the only bundled Scripture is the public-domain BSB stub (no ESV)", () => {
    const stubDir = path.join(root, "src/data/bsb-stub");
    for (const f of fs.readdirSync(stubDir)) {
      const j = JSON.parse(fs.readFileSync(path.join(stubDir, f), "utf8"));
      expect(j._note).toMatch(/public domain/i);
      expect(j._note).toMatch(/NOT ESV/);
    }
  });

  it(".env files are gitignored and .env.example has no value", () => {
    expect(fs.readFileSync(path.join(root, ".gitignore"), "utf8")).toMatch(/^\.env\*$/m);
    const example = fs.readFileSync(path.join(root, ".env.example"), "utf8");
    expect(example).toMatch(/^ESV_API_KEY=$/m);
    expect(example).toMatch(/^ELEVENLABS_API_KEY=$/m);
    expect(example).toMatch(/^ELEVENLABS_VOICE_NARRATOR=$/m);
    expect(example).toMatch(/^ELEVENLABS_VOICE_JESUS=$/m);
    expect(example).toMatch(/^ELEVENLABS_VOICE_PETER=$/m);
    expect(example).toMatch(/^ELEVENLABS_VOICE_GOD=$/m);
    expect(example).toMatch(/^ELEVENLABS_VOICE_ABRAM=$/m);
    expect(example).toMatch(/^ELEVENLABS_VOICE_PHARAOH=$/m);
  });
});
