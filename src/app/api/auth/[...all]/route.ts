import { z } from "zod";

import { auth } from "@/lib/auth";

const signInBody = z.strictObject({
  provider: z.literal("google"),
  callbackURL: z.string().optional(),
  errorCallbackURL: z.string().optional(),
});

async function handle(request: Request) {
  const path = new URL(request.url).pathname;
  const allowed =
    request.method === "GET"
      ? path === "/api/auth/callback/google"
      : request.method === "POST" &&
        ["/api/auth/sign-in/social", "/api/auth/sign-out"].includes(path);
  if (!allowed) return new Response(null, { status: 404 });
  if (
    request.method === "POST" &&
    request.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin
  )
    return new Response(null, { status: 403 });
  if (path === "/api/auth/sign-in/social") {
    try {
      signInBody.parse(await request.clone().json());
    } catch {
      return new Response(null, { status: 400 });
    }
  }
  const response = await auth.handler(request);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const GET = handle;
export const POST = handle;
