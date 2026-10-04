"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ReviewAccess, type ReviewOutcome } from "@/components/review-access";
import { Spinner } from "@/components/ui/spinner";

type SignupRequest = {
  id: string;
  givenName: string;
  familyName: string;
  contactEmail: string;
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
    <section className="min-h-0 lg:overflow-y-auto">
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
                className="flex flex-col gap-1 p-4 transition-colors hover:bg-muted sm:flex-row sm:items-center sm:justify-between"
                href={`/review/${request.id}`}
              >
                <span className="font-medium">
                  {request.givenName} {request.familyName}
                </span>
                <span className="text-sm text-muted-foreground">{request.contactEmail}</span>
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
