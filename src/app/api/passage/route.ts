import { handlePassageRequest } from "@/lib/scripture/passageRoute";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET(req: Request) {
  return handlePassageRequest(req);
}
