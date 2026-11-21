import "server-only";
import type { ProviderInfo, ScriptureProvider } from "./types";
import { bsbStubProvider } from "./bsbStubProvider";
import { esvProvider } from "./esvProvider";

const providers: Record<string, ScriptureProvider> = {
  [bsbStubProvider.id]: bsbStubProvider,
  [esvProvider.id]: esvProvider,
};

export const DEFAULT_PROVIDER_ID = "bsb";

/** Active provider, chosen server-side by SCRIPTURE_PROVIDER (bsb | esv). Unknown values fall back to bsb. */
export function getActiveProvider(): ScriptureProvider {
  const id = (process.env.SCRIPTURE_PROVIDER || DEFAULT_PROVIDER_ID).trim().toLowerCase();
  return providers[id] ?? providers[DEFAULT_PROVIDER_ID];
}

export function getProvider(id: string): ScriptureProvider | undefined {
  return providers[id];
}

/** Public, secret-free description of a provider for the client. */
export function providerInfo(p: ScriptureProvider): ProviderInfo {
  return { id: p.id, name: p.name, notice: p.notice, attribution: p.attribution };
}
