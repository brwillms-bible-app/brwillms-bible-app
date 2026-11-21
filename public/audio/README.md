# Scene audio

Public-domain recordings for mapped passages live in this folder.

## Expected file (not in the repository yet)

- `public/audio/john-21-voice-test.mp3` — John 21:1–25 voice test, generated in ElevenLabs (Roger = narrator, Kai = Jesus, Brian = Peter).

The audio map at `src/data/audio.json` already points at `/audio/john-21-voice-test.mp3`. Until this file is added here, `GET /api/speech?ref=John+21` returns 404.

Do not commit ESV audio. ESV audio must be streamed live through the ESV proxy and must never be stored or cached.

## ElevenLabs voices

Public default voice IDs live in `src/data/voices.json` and may be overridden by server env vars (no `NEXT_PUBLIC_` prefix). The API key is the only secret and must stay in `ELEVENLABS_API_KEY` on the server (for example, in Vercel).

| Env var | Default ElevenLabs voice | Used for |
| --- | --- | --- |
| `ELEVENLABS_API_KEY` | (account key, env only) | Required for any TTS |
| `ELEVENLABS_VOICE_NARRATOR` | **Roger** (`CwhRBWXzGAHq8TQ4Fs17`) | Narrator, speech tags, and the final fallback for every role |
| `ELEVENLABS_VOICE_JESUS` | **Kai** (`hfqsl1OMbiWsgPpht3el`) | Jesus, and the default divine voice for the LORD |
| `ELEVENLABS_VOICE_PETER` | **Brian** (`PGoKnSD4gKn2aS99wOR2`) | Peter, and the default voice for Abram |
| `ELEVENLABS_VOICE_GOD` | none (falls back to Kai, then Roger) | Optional dedicated voice for the LORD |
| `ELEVENLABS_VOICE_ABRAM` | none (falls back to Brian, then Roger) | Optional dedicated voice for Abram |
| `ELEVENLABS_VOICE_PHARAOH` | none (falls back to Roger) | Optional dedicated voice for Pharaoh |

Fallback order (env var if set, otherwise that slot's default ID):

- **the_lord:** `ELEVENLABS_VOICE_GOD` → `ELEVENLABS_VOICE_JESUS` (Kai) → `ELEVENLABS_VOICE_NARRATOR` (Roger)
- **abram:** `ELEVENLABS_VOICE_ABRAM` → `ELEVENLABS_VOICE_PETER` (Brian) → `ELEVENLABS_VOICE_NARRATOR` (Roger)
- **pharaoh:** `ELEVENLABS_VOICE_PHARAOH` → `ELEVENLABS_VOICE_NARRATOR` (Roger)
- Any other role falls back to the narrator (Roger).

The Genesis 12 scene is **verses 1–9 only**. In that range the LORD speaks twice and Abram and Pharaoh have no dialogue, so Abram and Pharaoh env vars are reserved for a later 10–20 pass.

Genesis 12 TTS is synthesized one segment at a time (under the Free-plan concurrency limit of 2) and returned as a single `audio/mpeg` stream. Same-format MP3 frames from the same model are concatenated; joints may have a tiny click.
