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
};

export function fakeDirectory(options: Options = {}) {
  const {
    groups = defaultGroups,
    users = ["taken.user@example.org", "ada.lovelace@example.org"],
    roles = { "role-1": { isSuperAdminRole: true } },
    assignments = Object.keys(roles),
    pageSize = 2,
    status,
  } = options;
  const original = globalThis.fetch;
  const calls: URL[] = [];
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
    if (url.hostname !== "admin.googleapis.com") return original(input, init);
    calls.push(url);
    const headers = new Headers(init?.headers);
    if (headers.get("Authorization") !== `Bearer ${actor.accessToken}`)
      return Response.json({}, { status: 401 });
    if (status) return Response.json({ error: { message: "denied" } }, { status });
    const path = decodeURIComponent(url.pathname.replace("/admin/directory/v1/", ""));
    const [kind, key] = path.split("/");
    if (kind === "users") return users.includes(key) ? Response.json({ id: "u" }) : notFound();
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
