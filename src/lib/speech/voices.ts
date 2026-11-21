import voicesData from "@/data/voices.json";

export interface RoleVoiceConfig {
  voiceEnv: string;
  fallbackEnvs: string[];
  /** Public ElevenLabs voice ID baked into the repo, if any. Empty until provided. Overridden by voiceEnv. */
  defaultVoiceId?: string;
  cast: string;
  todo?: string;
}

interface VoicesFile {
  _note: string;
  roles: Record<string, RoleVoiceConfig>;
}

export const voiceRoles = (voicesData as VoicesFile).roles;

export const NARRATOR_VOICE_ENV = "ELEVENLABS_VOICE_NARRATOR";

/**
 * Env var names to consult, in order, for a speaker role.
 * Unknown roles fall back to the narrator env only.
 */
export function voiceEnvChain(role: string): string[] {
  const cfg = voiceRoles[role];
  const chain: string[] = [];
  const add = (name: string) => {
    if (name && !chain.includes(name)) chain.push(name);
  };
  if (cfg) {
    add(cfg.voiceEnv);
    for (const name of cfg.fallbackEnvs) add(name);
  }
  add(NARRATOR_VOICE_ENV);
  return chain;
}

function defaultIdForEnv(envName: string): string {
  for (const cfg of Object.values(voiceRoles)) {
    if (cfg.voiceEnv === envName) return (cfg.defaultVoiceId ?? "").trim();
  }
  return "";
}

export type VoiceResolution =
  | { ok: true; role: string; voiceId: string; fromEnv: string; source: "env" | "default" }
  | { ok: false; role: string; error: string };

function envValue(name: string): string {
  return (process.env[name] ?? "").trim();
}

/**
 * Resolve a role to a voice ID. Env vars override baked-in defaults.
 * Does not invent IDs: only env values and defaultVoiceId entries already in voices.json.
 */
export function resolveVoice(role: string): VoiceResolution {
  const chain = voiceEnvChain(role);
  for (const name of chain) {
    const fromEnv = envValue(name);
    if (fromEnv) return { ok: true, role, voiceId: fromEnv, fromEnv: name, source: "env" };
    const fromDefault = defaultIdForEnv(name);
    if (fromDefault) return { ok: true, role, voiceId: fromDefault, fromEnv: name, source: "default" };
  }
  return {
    ok: false,
    role,
    error: `No voice ID is available for "${role}". Set ${NARRATOR_VOICE_ENV} or add a default for Roger (narrator). Roles without their own ID fall back to the narrator.`,
  };
}
