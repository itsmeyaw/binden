import { z } from "zod";

import { getReviewAccess } from "@/lib/auth";
import { getVerifiedSignupRequest } from "@/lib/review";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function deniedResponse(status: Awaited<ReturnType<typeof getReviewAccess>>["status"]) {
  switch (status) {
    case "signed-out":
    case "reconnect":
      return json({ outcome: status }, 401);
    case "denied":
      return json({ outcome: status }, 403);
    case "unavailable":
      return json({ outcome: status }, 503);
    default:
      return undefined;
  }
}

export async function GET(request: Request, context: RouteContext<"/api/review/requests/[id]">) {
  const access = await getReviewAccess(request.headers);
  const denied = deniedResponse(access.status);
  if (denied) return denied;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return json({ error: "Request not found." }, 404);
  try {
    const signup = await getVerifiedSignupRequest(id);
    if (!signup) return json({ error: "Request not found." }, 404);
    return json({ request: signup });
  } catch {
    return json({ outcome: "unavailable" }, 503);
  }
}
