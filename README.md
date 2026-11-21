# Picture Bible Adventures

A free, non-commercial, all-ages illustrated Bible explorer: our own artwork, book intros,
maps (MapLibre GL), and learning objectives, mapped to verse **references**. Scripture text comes
from a pluggable provider behind one server-side proxy.

**First deliverable:** a clickable **Genesis 12:1-9** scene (`/scene/abram-called`). Clicking the
painting calls `/api/passage`, which returns the verses and audio status; the page then shows the
verses, a MapLibre "journey" map (Haran → Shechem/Canaan), and the learning-objective callout.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional; defaults work with no keys
npm run dev                  # http://localhost:3000
npm test                     # unit tests (validator, proxy, key-leak, compliance guards)
npm run build                # production build
npm run verify:bundle        # builds with a sentinel ESV_API_KEY and proves it is not in client assets
node scripts/screenshot.mjs  # before/after-click screenshots -> screenshots/ (needs dev server + Chrome)
```

## Environment

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `SCRIPTURE_PROVIDER` | server | `bsb` | `bsb` = Berean Standard Bible **stub** (public domain, no key). `esv` = Crossway ESV API. |
| `ESV_API_KEY` | server only | — | Only needed when `SCRIPTURE_PROVIDER=esv`. Never `NEXT_PUBLIC_`, never committed. |
| `NEXT_PUBLIC_MAP_STYLE_URL` | browser | `https://tiles.openfreemap.org/styles/liberty` | Swappable MapLibre style URL. |

## Architecture

```
src/
  app/api/passage/route.ts     -> provider-agnostic proxy (validate -> active provider -> no-store JSON)
  app/api/esv/{text,audio,status}  -> ESV-specific proxy routes (audio streamed, redirect resolved server-side)
  lib/bible/books.ts           -> per-book/per-chapter verse COUNTS (numbers only; ESV versification)
  lib/bible/reference.ts       -> reference parser + limit validator (<500 verses AND < half a book)
  lib/scripture/types.ts       -> ScriptureProvider interface
  lib/scripture/bsbStubProvider.ts -> default stub (Genesis 12:1-9 BSB text; placeholders elsewhere; audio "coming soon")
  lib/scripture/esvProvider.ts -> optional ESV provider (live-only, rate-limited, notice)
  lib/scripture/registry.ts    -> picks provider from SCRIPTURE_PROVIDER
  lib/esv/*                    -> ESV key access (server-only), proxy, rate limiter, no-store headers, notice
  data/scenes.json             -> { passage, image, duration, objectiveId, mapRoute, ... }  (no Scripture text)
  data/objectives.json, maps.json (places + routes), books.json (intros) -> our own content
  data/bsb-stub/genesis-12.json -> public-domain BSB text for the stub only (NOT ESV)
  components/ScenePlayer.tsx   -> click-to-start scene; renders verses, audio, route map, objective
  components/MapCanvas.tsx     -> MapLibre GL map, markers, dashed route; SVG fallback
public/art/                    -> artwork (genesis-12.jpg cropped from the mockup painting; SVG placeholders)
```

Adding a real BSB (or any) translation later = implement `ScriptureProvider` and register it.

## ESV compliance design (applies whenever `SCRIPTURE_PROVIDER=esv`)

| Rule | Where it is enforced |
|---|---|
| No stored/hardcoded ESV text or audio | Nothing ESV in repo/data; responses held only in React state; no web storage/IndexedDB/Cache API/service worker (`tests/compliance.test.ts` scans `src/`, `public/`) |
| No caching | `Cache-Control: no-store` (+ CDN/Vercel variants) on every proxy response (`lib/esv/responses.ts`, `next.config.mjs`); upstream `fetch(..., {cache: "no-store"})`; routes `force-dynamic` |
| Audio streamed, never stored | `lib/esv/proxy.ts#handleAudioRequest`: resolves the API redirect server-side (Authorization only sent to api.esv.org), pipes the MP3 body straight through; `controlsList="nodownload"` |
| No TTS / AI voice | Only official ESV audio endpoint is used; test bans speechSynthesis |
| Live API only | `https://api.esv.org/v3/passage/text/` and `/v3/passage/audio/`, header `Authorization: Token <key>` |
| < 500 verses AND < half a book per request | `lib/bible/reference.ts#validatePassageRequest` runs on every request (all providers) before any upstream call; exact numeric range (e.g. `01012001-01012009`) is sent so the API returns exactly what was validated |
| One passage per request/page | Multiple passages (`;` `,`) rejected; each scene page shows one passage |
| Key server-side only | `process.env.ESV_API_KEY` read only in `server-only` modules; client gets a boolean/provider info; tests + `verify:bundle` prove it never appears in responses or client bundles; `.env*` gitignored |
| Rate limits (60/min, 1,000/hr, 5,000/day) | `lib/esv/rateLimit.ts` (in-memory per instance; use a shared store if scaled out) |
| Mandatory notice + link to esv.org | `components/EsvNotice.tsx` (verbatim text, linked URL) in the Scripture card and the footer of every page when ESV is active; `/copyright` page carries Crossway's longer copyright-page notice |
| "(ESV)" on quotations | `include-short-copyright=true` |
| Non-commercial | No ads, paywalls, subscriptions, sponsorships, or donation asks (Crossway counts donation solicitation as commercial) |

## Deploying (e.g. Vercel) — not done yet

1. Import the repo, framework = Next.js.
2. Env vars: `SCRIPTURE_PROVIDER` (`bsb` or `esv`), `ESV_API_KEY` (only for ESV; mark as server/secret), optional `NEXT_PUBLIC_MAP_STYLE_URL`.
3. Build: `npm run build` (the `prebuild` step copies the MapLibre worker into `public/vendor/`).
4. If running multiple instances with ESV, replace the in-memory rate limiter with a shared counter store.
