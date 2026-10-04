"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ReviewAccess, type ReviewOutcome } from "@/components/review-access";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export function ReviewRequest({ id }: { id: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    void fetchRequest(id).then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [id]);

  async function retry() {
    setState({ status: "loading" });
    setState(await fetchRequest(id));
  }

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-2xl">Signup request</CardTitle>
        <CardDescription>Applicant information submitted for review.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.status === "loading" && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Spinner /> Loading request
          </div>
        )}
        {state.status === "missing" && (
          <p className="text-muted-foreground">
            This verified signup request is no longer available.
          </p>
        )}
        {state.status === "ready" && (
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
        )}
        {state.status !== "loading" && state.status !== "ready" && state.status !== "missing" && (
          <ReviewAccess outcome={state.status} retry={() => void retry()} />
        )}
      </CardContent>
      <CardFooter>
        <Link className={buttonVariants({ variant: "outline" })} href="/review">
          Back to requests
        </Link>
      </CardFooter>
    </Card>
  );
}
