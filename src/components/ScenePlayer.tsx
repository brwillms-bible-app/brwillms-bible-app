"use client";

import { useEffect, useRef, useState } from "react";
import { EsvNotice } from "./EsvNotice";
import { RouteMapCard } from "./RouteMapCard";
import type { MapRoute, Objective } from "@/lib/content";
import type { PassageResult, ProviderInfo } from "@/lib/scripture/types";

type State =
  | { status: "idle" | "loading" }
  | { status: "ok"; data: PassageResult & { provider: ProviderInfo } }
  | { status: "not_configured"; message: string }
  | { status: "error"; message: string };

interface Props {
  passage: string;
  image: string;
  title: string;
  duration: number;
  provider: ProviderInfo;
  objective?: Objective;
  route?: MapRoute;
}

/**
 * Click-to-start scene. Our local artwork shows immediately; clicking fires ONE call to the
 * server-side proxy (/api/passage), which returns the verses + audio info from the active provider.
 * The response lives only in component state (memory) for this scene — never in any browser
 * storage (web storage, databases, cache storage) or a worker cache.
 */
export function ScenePlayer({ passage, image, title, duration, provider, objective, route }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => () => ctrlRef.current?.abort(), []);

  const start = async () => {
    if (state.status === "loading") return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setState({ status: "loading" });
    try {
      const r = await fetch(`/api/passage?ref=${encodeURIComponent(passage)}`, { cache: "no-store", signal: ctrl.signal });
      const body = await r.json();
      if (r.status === 503 && body.error === "not_configured") return setState({ status: "not_configured", message: body.message });
      if (!r.ok) return setState({ status: "error", message: body.message ?? "Something went wrong." });
      setState({ status: "ok", data: body });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setState({ status: "error", message: "Could not load the passage." });
    }
  };

  const data = state.status === "ok" ? state.data : undefined;
  const isEsv = (data?.provider.id ?? provider.id) === "esv";

  return (
    <div className="player">
      <div className="stage">
        <button
          type="button"
          className={`art-frame ${playing || data ? "playing" : ""}`}
          style={{ ["--dur" as string]: `${duration}s` }}
          onClick={start}
          aria-label={`Start scene: ${title} (${passage})`}
          data-testid="scene-start"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={`Illustration: ${title}`} />
          {state.status === "idle" && (
            <span className="start-overlay">
              <span className="start-btn">▶ Start the story</span>
              <span className="start-ref">{passage}</span>
            </span>
          )}
          {state.status === "loading" && <span className="start-overlay"><span className="start-btn">Loading…</span></span>}
          <span className="progress" />
        </button>

        <div className="scripture card" data-testid="scripture">
          <h3>📖 {data?.reference ?? passage}</h3>
          {state.status === "idle" && (
            <p className="muted">Tap the picture to start the story and load {passage}.</p>
          )}
          {state.status === "loading" && <p className="muted">Loading {passage}…</p>}
          {state.status === "not_configured" && (
            <div className="banner warn">
              <strong>API key not configured.</strong> {state.message}
            </div>
          )}
          {state.status === "error" && <div className="banner error">{state.message}</div>}
          {data?.stub && <span className="pill stub">STUB · {data.provider.name}</span>}
          {data?.verses && (
            <ol className="verses">
              {data.verses.map((v) => (
                <li key={v.number} value={v.number}>
                  <sup>{v.number}</sup> {v.text}
                </li>
              ))}
            </ol>
          )}
          {data?.passages?.map((p, i) => (
            <div className="passage" key={i}>
              {p}
            </div>
          ))}
          {data &&
            (data.audio.url ? (
              <audio
                ref={audioRef}
                src={data.audio.url}
                controls
                controlsList="nodownload noplaybackrate"
                preload="auto"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onContextMenu={(e) => e.preventDefault()}
              />
            ) : (
              <p className="audio-soon" data-testid="audio-soon">🔊 Audio coming soon</p>
            ))}
          {/* Mandatory Crossway notice whenever the ESV is the active provider. */}
          {isEsv ? (
            <EsvNotice compact />
          ) : (
            data?.provider.attribution && <p className="fineprint">{data.provider.attribution}</p>
          )}
        </div>
      </div>

      {data && (objective || route) && (
        <div className="side-by-side result">
          {route && <RouteMapCard route={route} />}
          {objective && (
            <section className="card objective" data-testid="objective">
              <div className="bulb">💡</div>
              <div>
                <h3>{objective.title}</h3>
                <p>{objective.text}</p>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
