import audioData from "@/data/audio.json";
import { esvVerseId, parseReference, type ParsedPassage } from "@/lib/bible/reference";

export const MAX_TTS_CHARS = 5000;

export type VoiceRole = "narrator" | "jesus" | "peter";

export interface VoiceConfig {
  voiceEnv: string;
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
  speakers: VoiceRole[];
}

export type AudioEntry = FileAudioEntry | TtsAudioEntry;

interface AudioMapFile {
  _note: string;
  voices: Record<string, VoiceConfig>;
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
