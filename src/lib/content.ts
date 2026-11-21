import scenesData from "@/data/scenes.json";
import booksData from "@/data/books.json";
import mapsData from "@/data/maps.json";
import objectivesData from "@/data/objectives.json";

/** A scene links OUR artwork + timing to a verse REFERENCE. It never contains Scripture text. */
export interface Scene {
  id: string;
  book: string;
  title: string;
  passage: string;
  image: string;
  duration: number;
  mapId?: string;
  /** Key into objectives.json */
  objectiveId?: string;
  /** Key into maps.json "routes" */
  mapRoute?: string;
}

export interface Objective {
  title: string;
  text: string;
}

export interface RouteStop {
  name: string;
  lng: number;
  lat: number;
  kind: "start" | "end" | "stop";
}

export interface MapRoute {
  title: string;
  context: string;
  stops: RouteStop[];
  /** [lng, lat] points for the drawn line */
  path: [number, number][];
}

export interface BookIntro {
  testament: string;
  author: string;
  written: string;
  focus: string;
  objectives: string[];
  color: string;
}

export interface MapPlace {
  name: string;
  lng: number;
  lat: number;
  /** Position on the offline SVG fallback (0-100 grid). */
  x: number;
  y: number;
}

export interface MapInfo {
  title: string;
  context: string;
  center: [number, number];
  zoom: number;
  places: MapPlace[];
}

export const scenes = scenesData.scenes as Scene[];
export const bookIntros: Record<string, BookIntro> = booksData.books;
export const maps = mapsData.maps as unknown as Record<string, MapInfo>;
export const routes = mapsData.routes as unknown as Record<string, MapRoute>;
export const objectives = objectivesData.objectives as Record<string, Objective>;

export function getScene(id: string): Scene | undefined {
  return scenes.find((s) => s.id === id);
}

export function scenesByBook(): { book: string; scenes: Scene[] }[] {
  const order: string[] = [];
  const groups = new Map<string, Scene[]>();
  for (const s of scenes) {
    if (!groups.has(s.book)) {
      groups.set(s.book, []);
      order.push(s.book);
    }
    groups.get(s.book)!.push(s);
  }
  return order.map((book) => ({ book, scenes: groups.get(book)! }));
}
