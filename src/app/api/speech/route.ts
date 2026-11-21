import { handleSpeechRequest } from "@/lib/speech/speechRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  return handleSpeechRequest(req);
}
