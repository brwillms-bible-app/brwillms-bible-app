// Builds with sentinel server keys and asserts they never appear in client assets (.next/static)
// or prerendered HTML. Also asserts the client bundle does not mention ELEVENLABS.
// Usage: npm run verify:bundle
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ESV_SENTINEL = "SENTINEL_ESV_KEY_" + Math.random().toString(36).slice(2);
const EL_SENTINEL = "SENTINEL_ELEVENLABS_KEY_" + Math.random().toString(36).slice(2);
execSync("npx next build", {
  stdio: "inherit",
  env: { ...process.env, ESV_API_KEY: ESV_SENTINEL, ELEVENLABS_API_KEY: EL_SENTINEL },
});

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}
const clientFiles = walk(".next/static");
const prerendered = walk(".next/server/app").filter((f) => /\.(html|rsc|body)$/.test(f));
const targets = [...clientFiles, ...prerendered];
const leaks = targets.filter((f) => {
  const buf = fs.readFileSync(f);
  return buf.includes(ESV_SENTINEL) || buf.includes(EL_SENTINEL);
});
if (leaks.length) {
  console.error("KEY LEAKED INTO:", leaks);
  process.exit(1);
}
const eleven = clientFiles.filter((f) => fs.readFileSync(f).includes("ELEVENLABS"));
if (eleven.length) {
  console.error("ELEVENLABS mentioned in client bundle:", eleven);
  process.exit(1);
}
console.log(`OK: scanned ${targets.length} client/prerendered files; ESV and ElevenLabs keys not present. .next/static has no ELEVENLABS string.`);
