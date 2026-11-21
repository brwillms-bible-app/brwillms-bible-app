import audioData from "@/data/audio.json";
import genesis12 from "@/data/bsb-stub/genesis-12.json";
import { esvVerseId, parseReference, type ParsedPassage } from "@/lib/bible/reference";
import { voiceRoles } from "./voices";

export const MAX_TTS_CHARS = 5000;

export const BSB_OPEN_QUOTE = "\u201c";
export const BSB_CLOSE_QUOTE = "\u201d";

export interface SpeechSegment {
  speaker: string;
  verses: string;
  /** True for in-scene dialogue. Wrapping quotation marks are omitted from `text` (John 21 pattern). */
  quoted: boolean;
  text: string;
}

export interface FileAudioEntry {
  id: string;
  passage: string;
  kind: "file";
  file: string;
}

export interface TtsAudioEntry {
  id: string;
  passage: string;
  kind: "tts";
  translation: "bsb";
  speakers: string[];
}

export interface TtsSegmentsEntry {
  id: string;
  passage: string;
  kind: "tts-segments";
  translation: "bsb";
  segments: SpeechSegment[];
}

export type AudioEntry = FileAudioEntry | TtsAudioEntry | TtsSegmentsEntry;

interface AudioMapFile {
  _note: string;
  entries: AudioEntry[];
}

export const audioMap = audioData as AudioMapFile;
export const audioEntries: AudioEntry[] = audioMap.entries;

function verseKey(p: ParsedPassage, chapter: number, verse: number): number {
  return Number(esvVerseId(p.book.number, chapter, verse));
}

export function passagesOverlap(a: ParsedPassage, b: ParsedPassage): boolean {
  if (a.book.number !== b.book.number) return false;
  const aStart = verseKey(a, a.startChapter, a.startVerse);
  const aEnd = verseKey(a, a.endChapter, a.endVerse);
  const bStart = verseKey(b, b.startChapter, b.startVerse);
  const bEnd = verseKey(b, b.endChapter, b.endVerse);
  return aStart <= bEnd && bStart <= aEnd;
}

/** Find a mapped audio entry whose passage overlaps the requested reference. */
export function findAudioEntry(ref: string): { request: ParsedPassage; entry: AudioEntry; mapped: ParsedPassage } | undefined {
  const request = parseReference(ref);
  if (!request.ok) return undefined;
  let best:
    | { request: ParsedPassage; entry: AudioEntry; mapped: ParsedPassage }
    | undefined;
  for (const entry of audioEntries) {
    const mapped = parseReference(entry.passage);
    if (!mapped.ok) continue;
    if (!passagesOverlap(request.passage, mapped.passage)) continue;
    const candidate = { request: request.passage, entry, mapped: mapped.passage };
    if (mapped.passage.display === request.passage.display) return candidate;
    if (!best) best = candidate;
  }
  return best;
}

export function isSafeAudioFilePath(file: string): boolean {
  return /^\/audio\/[A-Za-z0-9][A-Za-z0-9._-]*\.(mp3|m4a|wav|ogg)$/.test(file);
}

/** Restore typographic quotes around dialogue and join segments with a single space. */
export function reconstructBsbText(segments: SpeechSegment[]): string {
  return segments
    .map((s) => (s.quoted ? `${BSB_OPEN_QUOTE}${s.text}${BSB_CLOSE_QUOTE}` : s.text))
    .join(" ");
}

export function joinedStubText(book: string, chapter: number, startVerse: number, endVerse: number): string | undefined {
  if (book !== genesis12.book || chapter !== genesis12.chapter) return undefined;
  const parts: string[] = [];
  for (let n = startVerse; n <= endVerse; n++) {
    const v = genesis12.verses.find((x) => x.number === n);
    if (!v?.text) return undefined;
    parts.push(v.text);
  }
  return parts.join(" ");
}

export function segmentSpeakers(entry: AudioEntry): string[] {
  if (entry.kind === "tts-segments") return [...new Set(entry.segments.map((s) => s.speaker))];
  if (entry.kind === "tts") return entry.speakers;
  return [];
}
