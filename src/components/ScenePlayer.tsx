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
  /** Mapped BSB audio reference, if any. Omit for ESV (ESV audio stays on the live proxy). */
  speechRef?: string;
}

/**
 * Click-to-start scene. Our local artwork shows immediately; clicking fires ONE call to the
 * server-side proxy (/api/passage), which returns the verses + audio info from the active provider.
 * The response lives only in component state (memory) for this scene — never in any browser
 * storage (web storage, databases, cache storage) or a worker cache.
 */
export function ScenePlayer({ passage, image, title, duration, provider, objective, route, speechRef: mappedSpeechRef }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [playing, setPlaying] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const speechRef = useRef<HTMLAudioElement>(null);
  const speech = mappedSpeechRef;
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

  const playSpeech = () => {
    const el = speechRef.current;
    if (!el || !mappedSpeechRef) return;
    setSpeechError(null);
    // Set src and play inside the tap handler so iOS Safari (which blocks autoplay) allows playback.
    el.src = `/api/speech?ref=${encodeURIComponent(mappedSpeechRef)}`;
    const attempt = el.play();
    if (attempt) {
      attempt.catch(async () => {
        try {
          const res = await fetch(`/api/speech?ref=${encodeURIComponent(mappedSpeechRef)}`, { cache: "no-store" });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            setSpeechError(typeof body?.message === "string" ? body.message : "Could not play audio.");
          }
        } catch {
          setSpeechError("Could not play audio.");
        }
      });
    }
  };


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
            ) : speech ? null : (
              <p className="audio-soon" data-testid="audio-soon">🔊 Audio coming soon</p>
            ))}
          {speech && (
            <div className="speech-controls" data-testid="speech-controls">
              <button type="button" className="big" onClick={playSpeech} data-testid="play-speech">
                ▶ Play audio
              </button>
              <audio
                ref={speechRef}
                controls
                controlsList="nodownload noplaybackrate"
                preload="none"
                onContextMenu={(e) => e.preventDefault()}
              />
              <p className="fineprint">
                Playback starts when you tap Play. iPhones and iPads block audio that starts by itself.
              </p>
              {speechError && <div className="banner error">{speechError}</div>}
            </div>
          )}
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
