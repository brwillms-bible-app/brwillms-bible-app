import { describe, expect, it } from "vitest";
import { BOOKS, bookTotalVerses, findBook } from "@/lib/bible/books";
import { checkLimits, maxVersesForBook, parseReference, validatePassageRequest } from "@/lib/bible/reference";

describe("book data", () => {
  it("has 66 books with ESV versification", () => {
    expect(BOOKS).toHaveLength(66);
    expect(bookTotalVerses(findBook("Genesis")!)).toBe(1533);
    expect(bookTotalVerses(findBook("3 John")!)).toBe(15);
    expect(findBook("Revelation")!.chapterVerses[11]).toBe(18);
    expect(findBook("jn")!.name).toBe("John");
    expect(findBook("Psalms")!.name).toBe("Psalm");
    expect(findBook("I John")!.name).toBe("1 John");
  });
});

describe("parseReference", () => {
  it.each([
    ["John 1:1-5", "John 1:1-5", 5, "43001001-43001005"],
    ["John 11:35", "John 11:35", 1, "43011035-43011035"],
    ["Luke 2:8-14", "Luke 2:8-14", 7, "42002008-42002014"],
    ["Genesis 1", "Genesis 1:1-31", 31, "01001001-01001031"],
    ["Genesis 1:1-2:3", "Genesis 1:1-2:3", 34, "01001001-01002003"],
    ["Genesis 1-2", "Genesis 1:1-2:25", 56, "01001001-01002025"],
    ["Jude 3-5", "Jude 1:3-5", 3, "65001003-65001005"],
    ["1 John 1:1", "1 John 1:1", 1, "62001001-62001001"],
    ["  john   1:1 – 5 ", "John 1:1-5", 5, "43001001-43001005"],
  ])("%s", (input, display, count, q) => {
    const r = parseReference(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.passage.display).toBe(display);
      expect(r.passage.verseCount).toBe(count);
      expect(r.passage.esvQuery).toBe(q);
    }
  });

  it.each(["", "Hezekiah 1:1", "John 22:1", "John 1:99", "John 1:5-1", "John 1:1; Gen 1:1", "John 1:1,3", "x".repeat(100), "<script>"])(
    "rejects %j",
    (input) => expect(parseReference(input).ok).toBe(false),
  );
});

describe("Crossway limits (<500 verses AND < half a book)", () => {
  it("allows small passages", () => {
    expect(validatePassageRequest("John 1:1-5").ok).toBe(true);
    expect(validatePassageRequest("Genesis 1").ok).toBe(true);
  });

  it("rejects 500+ verses even when under half the book", () => {
    // Psalms has 2,461 verses; Psalm 1-50 is well over 500 verses but under half.
    const r = validatePassageRequest("Psalm 1-50");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/under 500/);
  });

  it("allows 499 verses and rejects exactly 500", () => {
    const ps = findBook("Psalm")!;
    // Build references hitting exact counts by scanning chapter boundaries.
    const p499 = parseReference("Psalm 1:1-1:1");
    expect(p499.ok).toBe(true);
    if (!p499.ok) return;
    const fake = (n: number) => ({ ...p499.passage, book: ps, verseCount: n });
    expect(checkLimits(fake(499)).ok).toBe(true);
    expect(checkLimits(fake(500)).ok).toBe(false);
  });

  it("rejects half a book or more", () => {
    // Ruth: 85 verses -> max 42.
    expect(maxVersesForBook("Ruth")).toBe(42);
    expect(validatePassageRequest("Ruth 1").ok).toBe(true); // 22 verses
    expect(validatePassageRequest("Ruth 1-2").ok).toBe(false); // 22 + 23 = 45 verses
  });

  it("uses strict less-than-half for exact halves", () => {
    // Jude has 25 verses -> 12 allowed, 13 rejected.
    expect(validatePassageRequest("Jude 1-12").ok).toBe(true);
    const r = validatePassageRequest("Jude 1-13");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/less than half/);
    // Haggai: 38 verses (2 chapters) -> 18 allowed, 19 rejected (exactly half also rejected).
    expect(validatePassageRequest("Haggai 1:1-2:3").ok).toBe(true); // 18 verses
    expect(validatePassageRequest("Haggai 1").ok).toBe(true); // 15 verses
    expect(validatePassageRequest("Haggai 1:1-2:4").ok).toBe(false); // 19 verses = exactly half
  });

  it("rejects a whole single-chapter book and whole small books", () => {
    expect(validatePassageRequest("Obadiah 1:1-21").ok).toBe(false);
    expect(validatePassageRequest("Philemon 1-25").ok).toBe(false);
    expect(validatePassageRequest("Genesis 1-50").ok).toBe(false);
    expect(validatePassageRequest("Genesis 1-25").ok).toBe(false); // > 500 verses
  });
});
