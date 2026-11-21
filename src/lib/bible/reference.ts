import { BOOKS, BookInfo, bookTotalVerses, findBook } from "./books";

/**
 * Crossway ESV API limits enforced on EVERY request (text and audio):
 *  - fewer than 500 verses, AND
 *  - less than half of the book the passage comes from.
 * (Crossway's own terms say "up to 500 verses ... or half a book, whichever is less";
 *  we apply the stricter "under 500" / "less than half" reading on purpose.)
 */
export const MAX_VERSES_EXCLUSIVE = 500;

export interface ParsedPassage {
  book: BookInfo;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
  verseCount: number;
  /** Human-friendly reference, e.g. "John 1:1-5". */
  display: string;
  /** Unambiguous ESV numeric range, e.g. "43001001-43001005". Sent to the API so it fetches exactly what we validated. */
  esvQuery: string;
}

export type ValidationResult =
  | { ok: true; passage: ParsedPassage }
  | { ok: false; error: string };

const MAX_INPUT_LENGTH = 64;

function pad(n: number, w: number) {
  return String(n).padStart(w, "0");
}

export function esvVerseId(book: number, chapter: number, verse: number): string {
  return `${pad(book, 2)}${pad(chapter, 3)}${pad(verse, 3)}`;
}

/** Count verses between two (inclusive) positions in one book. */
export function countVerses(book: BookInfo, sc: number, sv: number, ec: number, ev: number): number {
  if (sc === ec) return ev - sv + 1;
  let total = book.chapterVerses[sc - 1] - sv + 1;
  for (let c = sc + 1; c < ec; c++) total += book.chapterVerses[c - 1];
  total += ev;
  return total;
}

/**
 * Parse a single passage reference. Supported forms:
 *   "John 1:1-5", "John 1:1", "Genesis 1", "Genesis 1-2", "Genesis 1:1-2:3",
 *   "Jude 3-5" / "Jude 1:3-5" (single-chapter books).
 * Multiple passages (";" or ",") are rejected so each API call is one validated range.
 */
export function parseReference(input: string): ValidationResult {
  if (typeof input !== "string") return { ok: false, error: "Reference must be a string." };
  const raw = input.trim().replace(/\s+/g, " ").replace(/[\u2013\u2014]/g, "-");
  if (!raw) return { ok: false, error: "Reference is empty." };
  if (raw.length > MAX_INPUT_LENGTH) return { ok: false, error: "Reference is too long." };
  if (/[;,]/.test(raw)) return { ok: false, error: "Only one passage per request is allowed." };

  const m = /^((?:[123]|i{1,3}|first|second|third)?\s?[a-z][a-z .]*?)\s*(\d+)(?::(\d+))?(?:\s?-\s?(\d+)(?::(\d+))?)?$/i.exec(raw);
  if (!m) return { ok: false, error: `Could not understand reference "${raw}".` };
  const [, bookName, aStr, bStr, cStr, dStr] = m;
  const book = findBook(bookName);
  if (!book) return { ok: false, error: `Unknown book "${bookName.trim()}".` };

  const a = Number(aStr);
  const b = bStr !== undefined ? Number(bStr) : undefined;
  const c = cStr !== undefined ? Number(cStr) : undefined;
  const d = dStr !== undefined ? Number(dStr) : undefined;
  const chapters = book.chapterVerses.length;
  const singleChapter = chapters === 1;

  let sc: number, sv: number, ec: number, ev: number;
  if (b === undefined) {
    if (singleChapter) {
      // "Jude 3" or "Jude 3-5" => verses in chapter 1
      sc = ec = 1;
      sv = a;
      if (d !== undefined) return { ok: false, error: "Invalid reference." };
      ev = c ?? a;
    } else {
      // "Genesis 1" or "Genesis 1-2" (whole chapters), or "Genesis 1-2:3"
      sc = a;
      sv = 1;
      if (c === undefined) {
        ec = a;
        ev = NaN;
      } else if (d === undefined) {
        ec = c;
        ev = NaN;
      } else {
        ec = c;
        ev = d;
      }
    }
  } else {
    sc = a;
    sv = b;
    if (c === undefined) {
      ec = sc;
      ev = sv;
    } else if (d === undefined) {
      // "John 1:1-5"
      ec = sc;
      ev = c;
    } else {
      // "Genesis 1:1-2:3"
      ec = c;
      ev = d;
    }
  }

  if (sc < 1 || sc > chapters) return { ok: false, error: `${book.name} has ${chapters} chapter(s).` };
  if (ec < 1 || ec > chapters) return { ok: false, error: `${book.name} has ${chapters} chapter(s).` };
  if (Number.isNaN(ev)) ev = book.chapterVerses[ec - 1];
  if (sv < 1 || sv > book.chapterVerses[sc - 1])
    return { ok: false, error: `${book.name} ${sc} has ${book.chapterVerses[sc - 1]} verses.` };
  if (ev < 1 || ev > book.chapterVerses[ec - 1])
    return { ok: false, error: `${book.name} ${ec} has ${book.chapterVerses[ec - 1]} verses.` };
  if (ec < sc || (ec === sc && ev < sv)) return { ok: false, error: "Passage end comes before its start." };

  const verseCount = countVerses(book, sc, sv, ec, ev);
  const display =
    sc === ec
      ? sv === ev
        ? `${book.name} ${sc}:${sv}`
        : `${book.name} ${sc}:${sv}-${ev}`
      : `${book.name} ${sc}:${sv}-${ec}:${ev}`;
  const esvQuery = `${esvVerseId(book.number, sc, sv)}-${esvVerseId(book.number, ec, ev)}`;
  return {
    ok: true,
    passage: { book, startChapter: sc, startVerse: sv, endChapter: ec, endVerse: ev, verseCount, display, esvQuery },
  };
}

/** Check the Crossway limits for an already-parsed passage. */
export function checkLimits(p: ParsedPassage): { ok: true } | { ok: false; error: string } {
  const total = bookTotalVerses(p.book);
  if (p.verseCount >= MAX_VERSES_EXCLUSIVE) {
    return { ok: false, error: `Passage has ${p.verseCount} verses; requests must be under ${MAX_VERSES_EXCLUSIVE} verses.` };
  }
  // strictly less than half: verseCount < total / 2
  if (p.verseCount * 2 >= total) {
    return {
      ok: false,
      error: `Passage has ${p.verseCount} of ${total} verses in ${p.book.name}; requests must be less than half of a book.`,
    };
  }
  return { ok: true };
}

/** Parse + enforce limits. This is the single gate every ESV proxy request goes through. */
export function validatePassageRequest(input: string): ValidationResult {
  const parsed = parseReference(input);
  if (!parsed.ok) return parsed;
  const limits = checkLimits(parsed.passage);
  if (!limits.ok) return limits;
  return parsed;
}

/** Largest number of verses a single request may contain for a given book. */
export function maxVersesForBook(bookName: string): number | undefined {
  const b = findBook(bookName);
  if (!b) return undefined;
  const total = bookTotalVerses(b);
  const halfLimit = Math.ceil(total / 2) - 1; // largest n with 2n < total
  return Math.min(MAX_VERSES_EXCLUSIVE - 1, halfLimit);
}

export { BOOKS };
