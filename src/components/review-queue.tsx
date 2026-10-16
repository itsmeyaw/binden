"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { InboxIcon, SearchIcon, SearchXIcon, XIcon } from "lucide-react";

import { ReviewAccess, type ReviewOutcome } from "@/components/review-access";
import { statusLabels } from "@/components/review-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";

type SignupRequest = {
  id: string;
  givenName: string;
  familyName: string;
  contactEmail: string;
  workspaceEmail: string | null;
  status:
    | "verified"
    | "rejection_pending_notification"
    | "accepted"
    | "provisioning"
    | "awaiting_handover"
    | "handover_confirmed";
  createdAt: string;
};

type State =
  | { status: "loading" }
  | { status: "ready"; requests: SignupRequest[] }
  | { status: ReviewOutcome };

const labels: Record<SignupRequest["status"], string> = {
  ...statusLabels,
  verified: "Needs review",
  rejection_pending_notification: "Notification needs retrying",
};

const badgeVariants: Record<
  SignupRequest["status"],
  "default" | "destructive" | "secondary" | "outline"
> = {
  verified: "default",
  rejection_pending_notification: "destructive",
  accepted: "outline",
  provisioning: "outline",
  awaiting_handover: "outline",
  handover_confirmed: "secondary",
};

type StatusFilter = SignupRequest["status"] | "all";

async function fetchRequests(): Promise<State> {
  try {
    const response = await fetch("/api/review/requests", { cache: "no-store" });
    const result = (await response.json()) as {
      outcome?: ReviewOutcome;
      requests?: SignupRequest[];
    };
    if (!response.ok || !result.requests) return { status: result.outcome ?? "unavailable" };
    return { status: "ready", requests: result.requests };
  } catch {
    return { status: "unavailable" };
  }
}

export function ReviewQueue() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let active = true;
    void fetchRequests().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, []);

  async function retry() {
    setState({ status: "loading" });
    setState(await fetchRequests());
  }

  const requests = state.status === "ready" ? state.requests : [];
  const query = search.trim().toLowerCase();
  const filtered = requests.filter((request) => {
    if (statusFilter !== "all" && request.status !== statusFilter) return false;
    if (!query) return true;
    const fullName = `${request.givenName} ${request.familyName}`;
    return [fullName, request.contactEmail, request.workspaceEmail ?? ""].some((value) =>
      value.toLowerCase().includes(query),
    );
  });
  const filtering = query !== "" || statusFilter !== "all";
  const presentStatuses = (Object.keys(labels) as SignupRequest["status"][]).filter((status) =>
    requests.some((request) => request.status === status),
  );
  const statusItems: Record<string, string> = {
    all: "All statuses",
    ...Object.fromEntries(
      presentStatuses.map((status) => [
        status,
        `${labels[status]} (${requests.filter((request) => request.status === status).length})`,
      ]),
    ),
  };

  function reset() {
    setSearch("");
    setStatusFilter("all");
  }

  return (
    <section className="flex min-h-0 flex-col gap-4">
      {state.status === "loading" && (
        <div className="flex items-center gap-2 p-4 text-muted-foreground">
          <Spinner /> Loading requests
        </div>
      )}
      {state.status === "ready" && requests.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>No signup requests</EmptyTitle>
            <EmptyDescription>
              New requests will appear here once applicants submit the form.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {state.status === "ready" && requests.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <InputGroup className="w-full sm:max-w-xs">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Search requests"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or email…"
                type="search"
                value={search}
              />
            </InputGroup>
            <Select
              items={statusItems}
              onValueChange={(value) => setStatusFilter((value ?? "all") as StatusFilter)}
              value={statusFilter}
            >
              <SelectTrigger aria-label="Filter by status" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtering && (
              <Button onClick={reset} size="sm" type="button" variant="ghost">
                <XIcon data-icon="inline-start" /> Reset
              </Button>
            )}
            <p className="ml-auto text-sm text-muted-foreground">
              Showing {filtered.length} of {requests.length}
            </p>
          </div>
          {filtered.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>No matching requests</EmptyTitle>
                <EmptyDescription>Try a different search or status.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={reset} type="button" variant="outline">
                  Reset
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead className="hidden md:table-cell">Workspace email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((request) => (
                    <TableRow className="relative" key={request.id}>
                      <TableCell>
                        <Link
                          className="font-medium after:absolute after:inset-0 hover:underline"
                          href={`/review/${request.id}`}
                        >
                          {request.givenName} {request.familyName}
                        </Link>
                        <div className="text-sm text-muted-foreground">{request.contactEmail}</div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {request.workspaceEmail || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badgeVariants[request.status]}>
                          {labels[request.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
                        {new Date(request.createdAt).toLocaleDateString(undefined, {
                          dateStyle: "medium",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
      {state.status !== "loading" && state.status !== "ready" && (
        <ReviewAccess outcome={state.status} retry={() => void retry()} />
      )}
    </section>
  );
}
