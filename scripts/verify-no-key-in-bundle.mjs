// Builds with a sentinel ESV_API_KEY and asserts it never appears in client assets (.next/static)
// or prerendered HTML. Usage: npm run verify:bundle
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SENTINEL = "SENTINEL_ESV_KEY_" + Math.random().toString(36).slice(2);
execSync("npx next build", { stdio: "inherit", env: { ...process.env, ESV_API_KEY: SENTINEL } });

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}
const targets = [...walk(".next/static"), ...walk(".next/server/app").filter((f) => /\.(html|rsc|body)$/.test(f))];
const leaks = targets.filter((f) => fs.readFileSync(f).includes(SENTINEL));
if (leaks.length) {
  console.error("KEY LEAKED INTO:", leaks);
  process.exit(1);
}
console.log(`OK: scanned ${targets.length} client/prerendered files; ESV_API_KEY not present.`);
