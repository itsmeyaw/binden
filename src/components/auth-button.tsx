"use client";

import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
const subscribe = () => () => {};

export function AuthButton({
  action = "sign-in",
  className,
  label,
}: {
  action?: "sign-in" | "sign-out" | "reconnect";
  className?: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  async function run() {
    setPending(true);
    try {
      if (action === "sign-out" || action === "reconnect") {
        const result = await authClient.signOut();
        if (result.error) throw new Error();
        if (action === "sign-out") {
          window.location.replace("/");
          return;
        }
      }
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/review",
        errorCallbackURL: "/?error=sign-in",
      });
      if (result.error) throw new Error();
    } catch {
      setPending(false);
    }
  }

  return (
    <Button className={className} disabled={!ready || pending} onClick={run} type="button">
      {pending && <Spinner data-icon="inline-start" />}
      {pending
        ? "Please wait..."
        : action === "sign-out"
          ? "Sign out"
          : action === "reconnect"
            ? "Reconnect Google"
            : (label ?? "Sign in with Google")}
    </Button>
  );
}
