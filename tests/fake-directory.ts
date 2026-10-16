// Serves the Directory calls the app makes with the acting administrator's token; every other
// request still reaches the real fetch (the database driver may use it).
export const actor = { accessToken: "admin-token", profile: { id: "admin-1" } };

export const defaultGroups = [
  { id: "sim-events", email: "events@example.org", name: "Events team" },
  { id: "sim-volunteers", email: "volunteers@example.org", name: "Volunteers" },
  { id: "sim-board", email: "board@example.org", name: "Board" },
  { id: "sim-flaky", email: "flaky@example.org", name: "Flaky group" },
  { id: "sim-recovering", email: "recovering@example.org", name: "Recovering group" },
];

type Options = {
  groups?: typeof defaultGroups;
  users?: string[];
  roles?: Record<string, object>;
  assignments?: string[];
  pageSize?: number;
  // Fail every Directory call with this status.
  status?: number;
  // Fail every Gmail call with this status.
  mailStatus?: number;
};

export function fakeDirectory(options: Options = {}) {
  const {
    groups = defaultGroups,
    users = ["taken.user@example.org", "ada.lovelace@example.org"],
    roles = { "role-1": { isSuperAdminRole: true } },
    assignments = Object.keys(roles),
    pageSize = 2,
    status,
    mailStatus,
  } = options;
  const original = globalThis.fetch;
  const calls: URL[] = [];
  // Decoded RFC 5322 messages accepted by Gmail.
  const messages: string[] = [];
  // Directory writes, in order; bodies include passwords, so tests only.
  const writes: { method: string; path: string; body: Record<string, unknown> }[] = [];
  const known = new Set(users.map((email) => email.toLowerCase()));
  const page = <T>(all: T[], url: URL, key: string) => {
    const start = Number(url.searchParams.get("pageToken") ?? 0);
    const next = start + pageSize;
    return Response.json({
      [key]: all.slice(start, next),
      ...(next < all.length ? { nextPageToken: String(next) } : {}),
    });
  };
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "gmail.googleapis.com") {
      if (new Headers(init?.headers).get("Authorization") !== `Bearer ${actor.accessToken}`)
        return Response.json({}, { status: 401 });
      if (mailStatus)
        return Response.json({ error: { message: "denied" } }, { status: mailStatus });
      if (init?.method !== "POST" || url.pathname !== "/gmail/v1/users/me/messages/send")
        return notFound();
      const { raw } = JSON.parse(String(init.body));
      messages.push(Buffer.from(raw, "base64url").toString("utf8"));
      return Response.json({ id: "m1" });
    }
    if (url.hostname !== "admin.googleapis.com") return original(input, init);
    calls.push(url);
    const headers = new Headers(init?.headers);
    if (headers.get("Authorization") !== `Bearer ${actor.accessToken}`)
      return Response.json({}, { status: 401 });
    if (status) return Response.json({ error: { message: "denied" } }, { status });
    const path = decodeURIComponent(url.pathname.replace("/admin/directory/v1/", ""));
    const [kind, key] = path.split("/");
    if (kind === "users" && !key && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      writes.push({ method: "POST", path, body });
      const email = String(body.primaryEmail).toLowerCase();
      if (known.has(email))
        return Response.json({ error: { message: "Entity already exists" } }, { status: 409 });
      known.add(email);
      known.add(`new-${email}`);
      return Response.json({ id: `new-${email}` });
    }
    if (kind === "users" && init?.method === "PATCH") {
      writes.push({ method: "PATCH", path, body: JSON.parse(String(init.body)) });
      return known.has(key.toLowerCase()) ? Response.json({ id: key }) : notFound();
    }
    if (kind === "users")
      return known.has(key.toLowerCase()) ? Response.json({ id: "u" }) : notFound();
    if (path === "customer/my_customer/roleassignments") {
      if (url.searchParams.get("userKey") !== actor.profile.id) return notFound();
      return page(
        assignments.map((roleId) => ({ roleId })),
        url,
        "items",
      );
    }
    if (path.startsWith("customer/my_customer/roles/")) {
      const role = roles[path.split("/")[3]];
      return role ? Response.json(role) : notFound();
    }
    if (kind === "groups" && key)
      return groups.some((group) => group.email === key) ? Response.json({ id: "g" }) : notFound();
    if (kind === "groups") {
      assertCustomer(url);
      return page(groups, url, "groups");
    }
    return notFound();
  };
  return {
    calls,
    messages,
    writes,
    restore() {
      globalThis.fetch = original;
    },
  };
}

function assertCustomer(url: URL) {
  if (url.searchParams.get("customer") !== "my_customer") throw new Error("Missing customer");
}

function notFound() {
  return Response.json({ error: { message: "Not Found" } }, { status: 404 });
}
