"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";

import { ReviewAccess, type ReviewOutcome } from "@/components/review-access";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

type SignupRequest = {
  id: string;
  givenName: string;
  familyName: string;
  contactEmail: string;
  phone: string | null;
  connection: string | null;
  createdAt: string;
};

type State =
  | { status: "loading" }
  | { status: "unselected" }
  | { status: "ready"; request: SignupRequest }
  | { status: "missing" }
  | { status: ReviewOutcome };

async function fetchRequest(id: string): Promise<State> {
  try {
    const response = await fetch(`/api/review/requests/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const result = (await response.json()) as {
      outcome?: ReviewOutcome;
      request?: SignupRequest;
    };
    if (response.status === 404) return { status: "missing" };
    if (!response.ok || !result.request) return { status: result.outcome ?? "unavailable" };
    return { status: "ready", request: result.request };
  } catch {
    return { status: "unavailable" };
  }
}

export function ReviewRequest({ id }: { id?: string }) {
  const [state, setState] = useState<State>({ status: id ? "loading" : "unselected" });

  useEffect(() => {
    if (!id) return;
    const requestId = id;
    let active = true;
    void fetchRequest(requestId).then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [id]);

  async function retry() {
    if (!id) return;
    setState({ status: "loading" });
    setState(await fetchRequest(id));
  }

  return (
    <section className="min-h-0 p-4 lg:overflow-y-auto">
      {id && (
        <Button
          className="mb-4 lg:hidden"
          type="button"
          variant="ghost"
          render={<Link href="/review" />}
        >
          <ArrowLeftIcon /> Back to requests
        </Button>
      )}
      {state.status === "loading" && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner /> Loading request
        </div>
      )}
      {state.status === "unselected" && (
        <p className="text-muted-foreground">Select a signup request to review its details.</p>
      )}
      {state.status === "missing" && (
        <p className="text-muted-foreground">
          This verified signup request is no longer available.
        </p>
      )}
      {state.status === "ready" && (
        <div className="flex flex-col gap-5">
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="font-medium">Name</dt>
              <dd>
                {state.request.givenName} {state.request.familyName}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Contact email</dt>
              <dd className="break-all">{state.request.contactEmail}</dd>
            </div>
            <div>
              <dt className="font-medium">Phone</dt>
              <dd>{state.request.phone ?? "Not provided"}</dd>
            </div>
            <div>
              <dt className="font-medium">Submitted</dt>
              <dd>{new Date(state.request.createdAt).toLocaleDateString()}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium">Connection to the nonprofit</dt>
              <dd className="whitespace-pre-wrap">{state.request.connection ?? "Not provided"}</dd>
            </div>
          </dl>
          <Separator />
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Action:</span>
            <Button type="button">Accept</Button>
            <Button type="button" variant="destructive">
              Reject
            </Button>
          </div>
        </div>
      )}
      {state.status !== "loading" &&
        state.status !== "ready" &&
        state.status !== "missing" &&
        state.status !== "unselected" && (
          <ReviewAccess outcome={state.status} retry={() => void retry()} />
        )}
    </section>
  );
}
