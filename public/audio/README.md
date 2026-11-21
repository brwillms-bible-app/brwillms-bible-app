# Scene audio

Public-domain recordings for mapped passages live in this folder.

## Expected file (not in the repository yet)

- `public/audio/john-21-voice-test.mp3` — John 21:1–25 voice test, generated in ElevenLabs (Roger = narrator, Kai = Jesus, Brian = Peter).

The audio map at `src/data/audio.json` already points at `/audio/john-21-voice-test.mp3`. Until this file is added here, `GET /api/speech?ref=John+21` returns 404.

Do not commit ESV audio. ESV audio must be streamed live through the ESV proxy and must never be stored or cached.
