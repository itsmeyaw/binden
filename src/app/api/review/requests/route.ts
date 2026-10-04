import { getReviewAccess } from "@/lib/auth";
import { listVerifiedSignupRequests } from "@/lib/review";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function deniedResponse(status: Awaited<ReturnType<typeof getReviewAccess>>["status"]) {
  switch (status) {
    case "signed-out":
      return json({ outcome: status }, 401);
    case "denied":
      return json({ outcome: status }, 403);
    case "reconnect":
      return json({ outcome: status }, 401);
    case "unavailable":
      return json({ outcome: status }, 503);
    default:
      return undefined;
  }
}

export async function GET(request: Request) {
  const access = await getReviewAccess(request.headers);
  const denied = deniedResponse(access.status);
  if (denied) return denied;
  try {
    return json({ requests: await listVerifiedSignupRequests() });
  } catch {
    return json({ outcome: "unavailable" }, 503);
  }
}
