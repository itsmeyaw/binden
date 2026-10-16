"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  InboxIcon,
  SearchIcon,
  SearchXIcon,
  XIcon,
} from "lucide-react";

import { ReviewAccess, type ReviewOutcome } from "@/components/review-access";
import { ReviewRequest } from "@/components/review-request";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

const PAGE_SIZE = 10;

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
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Kept separate from the selection so the sheet keeps its content while closing.
  const [sheetOpen, setSheetOpen] = useState(false);

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

  // Refetches without the loading state so the open sheet stays mounted.
  async function refresh() {
    const next = await fetchRequests();
    if (next.status === "ready") setState(next);
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
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRequests = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selectedIndex = filtered.findIndex((request) => request.id === selectedId);
  const selected = filtered[selectedIndex];
  const open = sheetOpen && selectedIndex !== -1;
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
    setPage(0);
  }

  function select(index: number) {
    const request = filtered[index];
    if (!request) return;
    setSelectedId(request.id);
    setPage(Math.floor(index / PAGE_SIZE));
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      )
        return;
      if (event.key === "j") select(selectedIndex + 1);
      else if (event.key === "k") select(selectedIndex - 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

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
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
                placeholder="Search by name or email…"
                type="search"
                value={search}
              />
            </InputGroup>
            <Select
              items={statusItems}
              onValueChange={(value) => {
                setStatusFilter((value ?? "all") as StatusFilter);
                setPage(0);
              }}
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
                  {pageRequests.map((request) => (
                    <TableRow
                      className="relative"
                      data-state={open && request.id === selectedId ? "selected" : undefined}
                      key={request.id}
                    >
                      <TableCell>
                        <Link
                          className="font-medium after:absolute after:inset-0 hover:underline"
                          href={`/review/${request.id}`}
                          onClick={(event) => {
                            // Modified and non-primary clicks keep the standalone page behavior.
                            if (
                              event.button === 0 &&
                              !event.metaKey &&
                              !event.ctrlKey &&
                              !event.shiftKey &&
                              !event.altKey
                            ) {
                              event.preventDefault();
                              setSelectedId(request.id);
                              setSheetOpen(true);
                            }
                          }}
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
          {filtered.length > 0 && pageCount > 1 && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Page {currentPage + 1} of {pageCount}
              </p>
              <div className="flex gap-2">
                <Button
                  aria-label="Previous page"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <ChevronLeftIcon />
                </Button>
                <Button
                  aria-label="Next page"
                  disabled={currentPage === pageCount - 1}
                  onClick={() => setPage(currentPage + 1)}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            </div>
          )}
          <Sheet onOpenChange={setSheetOpen} open={open}>
            <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
              <SheetHeader className="border-b pr-12">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <SheetTitle>
                      {selected && `${selected.givenName} ${selected.familyName}`}
                    </SheetTitle>
                    <SheetDescription>
                      Request {selectedIndex + 1} of {filtered.length}
                      <span className="hidden sm:inline"> · J/K to switch</span>
                    </SheetDescription>
                  </div>
                  <Button
                    aria-label="Previous request"
                    disabled={selectedIndex <= 0}
                    onClick={() => select(selectedIndex - 1)}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                  >
                    <ChevronUpIcon />
                  </Button>
                  <Button
                    aria-label="Next request"
                    disabled={selectedIndex === filtered.length - 1}
                    onClick={() => select(selectedIndex + 1)}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                  >
                    <ChevronDownIcon />
                  </Button>
                </div>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {selected && (
                  <ReviewRequest id={selected.id} key={selected.id} onChanged={refresh} />
                )}
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
      {state.status !== "loading" && state.status !== "ready" && (
        <ReviewAccess outcome={state.status} retry={() => void retry()} />
      )}
    </section>
  );
}
