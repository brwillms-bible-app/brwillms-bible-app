// Before/after-click screenshots of the Genesis 12 scene (uses system Chrome via playwright-core).
import { chromium } from "playwright-core";
const base = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
const logs = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && logs.push(`${m.type()}: ${m.text()}`));
const passageCalls = [];
page.on("request", (r) => r.url().includes("/api/") && passageCalls.push(r.url()));
await page.goto(`${base}/`, { waitUntil: "networkidle" });
await page.screenshot({ path: "screenshots/0-home.png", fullPage: true });
await page.goto(`${base}/scene/abram-called`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: "screenshots/1-genesis12-before-click.png", fullPage: true });
await page.click('[data-testid="scene-start"]');
await page.waitForSelector('[data-testid="objective"]', { timeout: 15000 });
await page.waitForTimeout(6000); // let map tiles + route render
await page.screenshot({ path: "screenshots/2-genesis12-after-click.png", fullPage: true });
const verses = await page.locator(".verses li").count();
const route = await page.locator('[data-testid="route-map"] canvas').count();
console.log(JSON.stringify({ verses, routeMapCanvas: route, apiCalls: passageCalls, consoleIssues: logs.slice(0, 10) }, null, 2));
await browser.close();
