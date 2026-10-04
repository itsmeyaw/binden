"use client";

import { forwardRef, useEffect, useEffectEvent, useImperativeHandle, useRef } from "react";

import { FieldDescription } from "@/components/ui/field";

type Turnstile = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

type TurnstileChallengeProps = {
  action: "signup" | "resend";
  onToken: (token: string) => void;
};

export type TurnstileChallengeHandle = { reset: () => void };

export const turnstileConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

export const TurnstileChallenge = forwardRef<TurnstileChallengeHandle, TurnstileChallengeProps>(
  function TurnstileChallenge({ action, onToken }, ref) {
    const challenge = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | undefined>(undefined);
    const reportToken = useEffectEvent(onToken);

    useImperativeHandle(
      ref,
      () => ({
        reset() {
          if (widgetId.current) window.turnstile?.reset(widgetId.current);
          onToken("");
        },
      }),
      [onToken],
    );

    useEffect(() => {
      const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      if (!siteKey || !challenge.current) return;

      const render = () => {
        if (!challenge.current || !window.turnstile || widgetId.current) return;
        widgetId.current = window.turnstile.render(challenge.current, {
          sitekey: siteKey,
          action,
          theme: "light",
          callback: reportToken,
          "expired-callback": () => reportToken(""),
          "error-callback": () => reportToken(""),
        });
      };
      const script =
        (document.getElementById("turnstile-script") as HTMLScriptElement | null) ??
        document.createElement("script");
      const newScript = !script.isConnected;
      if (newScript) {
        script.id = "turnstile-script";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
      }
      script.addEventListener("load", render);
      if (newScript) document.head.append(script);
      render();

      return () => {
        script.removeEventListener("load", render);
        if (widgetId.current) window.turnstile?.remove(widgetId.current);
        widgetId.current = undefined;
      };
    }, [action]);

    if (!turnstileConfigured)
      return <FieldDescription>Verification is not configured yet.</FieldDescription>;
    return <div ref={challenge} />;
  },
);
