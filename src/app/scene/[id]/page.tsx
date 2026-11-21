import Link from "next/link";
import { notFound } from "next/navigation";
import { bookIntros, getScene, maps, objectives, routes, scenes } from "@/lib/content";
import { getActiveProvider, providerInfo } from "@/lib/scripture/registry";
import { ScenePlayer } from "@/components/ScenePlayer";
import { BookIntroCard } from "@/components/BookIntroCard";
import { MapPanel } from "@/components/MapPanel";
import { findAudioEntry } from "@/lib/speech/audioMap";

// Rendered per request so the active provider reflects the live server env.
export const dynamic = "force-dynamic";

export default async function ScenePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scene = getScene(id);
  if (!scene) notFound();
  const idx = scenes.findIndex((s) => s.id === scene.id);
  const prev = scenes[idx - 1];
  const next = scenes[idx + 1];
  // Only secret-free provider info crosses to the client.
  const provider = providerInfo(getActiveProvider());

  return (
    <div className="scene-page">
      <div className="scene-head">
        <Link href="/" className="back">
          ← All scenes
        </Link>
        <h1>{scene.title}</h1>
        <span className="pill">{scene.passage}</span>
      </div>
      <ScenePlayer
        key={scene.id}
        passage={scene.passage}
        image={scene.image}
        title={scene.title}
        duration={scene.duration}
        provider={provider}
        objective={scene.objectiveId ? objectives[scene.objectiveId] : undefined}
        route={scene.mapRoute ? routes[scene.mapRoute] : undefined}
        speechRef={provider.id !== "esv" ? findAudioEntry(scene.passage)?.mapped.display : undefined}
      />
      <div className="side-by-side">
        <BookIntroCard name={scene.book} intro={bookIntros[scene.book]} />
        <MapPanel map={scene.mapId ? maps[scene.mapId] : undefined} />
      </div>
      <nav className="scene-nav">
        {prev ? <Link href={`/scene/${prev.id}`}>← {prev.title}</Link> : <span />}
        {next ? <Link href={`/scene/${next.id}`}>{next.title} →</Link> : <span />}
      </nav>
    </div>
  );
}
