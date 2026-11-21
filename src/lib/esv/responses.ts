/** Headers applied to every ESV proxy response: nothing may be cached by browsers, CDNs, or service workers. */
export const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
};

export function jsonNoStore(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...NO_STORE_HEADERS, "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}
