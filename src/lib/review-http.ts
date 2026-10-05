import type { getReviewAccess } from "@/lib/auth";

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function deniedResponse(status: Awaited<ReturnType<typeof getReviewAccess>>["status"]) {
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

// Drizzle wraps driver errors, so the Postgres code may be on `cause`.
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || !error) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}
