import { handleTextRequest } from "@/lib/esv/proxy";

// Always run on demand; never statically render, revalidate, or cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET(req: Request) {
  return handleTextRequest(req);
}
