type SiteverifyResponse = {
  success: boolean;
  hostname?: string;
  action?: string;
};

export async function verifyTurnstile(token: string, request: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const hostname = process.env.TURNSTILE_HOSTNAME;
  if (!secret || !hostname) return false;

  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  const remoteIp = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  if (remoteIp) body.set("remoteip", remoteIp.split(",")[0].trim());

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const result = (await response.json()) as SiteverifyResponse;
    return response.ok && result.success && result.hostname === hostname && result.action === "signup";
  } catch {
    return false;
  }
}
