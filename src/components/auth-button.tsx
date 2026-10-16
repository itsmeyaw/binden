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
      {!pending && action === "sign-in" && (
        <svg data-icon="inline-start" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
        </svg>
      )}
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
