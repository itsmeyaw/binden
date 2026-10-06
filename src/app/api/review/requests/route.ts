import { getReviewAccess } from "@/lib/auth";
import { deniedResponse, json } from "@/lib/review-http";
import { listReviewableSignupRequests } from "@/lib/review";

export async function GET(request: Request) {
  const access = await getReviewAccess(request.headers);
  const denied = deniedResponse(access.status);
  if (denied) return denied;
  try {
    return json({ requests: await listReviewableSignupRequests() });
  } catch {
    return json({ outcome: "unavailable" }, 503);
  }
}
