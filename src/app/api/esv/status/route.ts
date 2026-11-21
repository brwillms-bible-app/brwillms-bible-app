import { handleStatusRequest } from "@/lib/esv/proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return handleStatusRequest();
}
