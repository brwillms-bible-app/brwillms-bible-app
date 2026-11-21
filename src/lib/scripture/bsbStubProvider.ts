import "server-only";
import type { ScriptureProvider } from "./types";
import genesis12 from "@/data/bsb-stub/genesis-12.json";

/**
 * STUB Berean Standard Bible provider (public domain — no key, no license fees).
 * Only Genesis 12:1-9 is bundled for the first clickable scene. Any other reference returns
 * obviously-marked placeholder verses. Audio is not available yet ("coming soon").
 */
export const bsbStubProvider: ScriptureProvider = {
  id: "bsb",
  name: "Berean Standard Bible (stub)",
  attribution: "Berean Standard Bible (BSB) — public domain. BereanBible.com",
  isConfigured: () => true,
  async getPassage(p) {
    const verses = [];
    for (let c = p.startChapter; c <= p.endChapter; c++) {
      const first = c === p.startChapter ? p.startVerse : 1;
      const last = c === p.endChapter ? p.endVerse : p.book.chapterVerses[c - 1];
      for (let v = first; v <= last; v++) {
        const real =
          p.book.name === genesis12.book && c === genesis12.chapter
            ? genesis12.verses.find((x) => x.number === v)
            : undefined;
        if (real) verses.push({ number: v, text: real.text });
        else {
          verses.push({ number: v, text: `[Placeholder — BSB text for ${p.book.name} ${c}:${v} coming soon]` });
        }
      }
    }
    return {
      reference: p.display,
      stub: true,
      verses,
      audio: { url: null, comingSoon: true },
    };
  },
};
