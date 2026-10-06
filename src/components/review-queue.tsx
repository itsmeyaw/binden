"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ReviewAccess, type ReviewOutcome } from "@/components/review-access";
import { statusLabels } from "@/components/review-progress";
import { Spinner } from "@/components/ui/spinner";

type SignupRequest = {
  id: string;
  givenName: string;
  familyName: string;
  contactEmail: string;
  status:
    | "verified"
    | "rejection_pending_notification"
    | "accepted"
    | "provisioning"
    | "awaiting_handover";
  createdAt: string;
};

type State =
  | { status: "loading" }
  | { status: "ready"; requests: SignupRequest[] }
  | { status: ReviewOutcome };

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

  return (
    <section className="@container/queue min-h-0 lg:overflow-y-auto">
      {state.status === "loading" && (
        <div className="flex items-center gap-2 p-4 text-muted-foreground">
          <Spinner /> Loading requests
        </div>
      )}
      {state.status === "ready" && state.requests.length === 0 && (
        <p className="p-4 text-muted-foreground">
          There are no verified signup requests to review.
        </p>
      )}
      {state.status === "ready" && state.requests.length > 0 && (
        <ul className="divide-y">
          {state.requests.map((request) => (
            <li key={request.id}>
              <Link
                className="flex flex-col gap-y-0 gap-x-1 px-4 py-3 transition-colors hover:bg-muted @2xl/queue:flex-row @2xl/queue:items-center @2xl/queue:justify-between"
                href={`/review/${request.id}`}
              >
                <span className="font-medium">
                  {request.givenName} {request.familyName}
                </span>
                <span className="text-sm text-muted-foreground">
                  {request.status === "rejection_pending_notification"
                    ? "Notification needs retrying"
                    : request.status === "verified"
                      ? request.contactEmail
                      : statusLabels[request.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {state.status !== "loading" && state.status !== "ready" && (
        <div className="p-4">
          <ReviewAccess outcome={state.status} retry={() => void retry()} />
        </div>
      )}
    </section>
  );
}
