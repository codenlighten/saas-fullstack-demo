"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type State = { kind: "waiting" } | { kind: "active"; plan: string } | { kind: "failed" };

export function SuccessStatus() {
  const email = useSearchParams().get("email");
  const [state, setState] = useState<State>({ kind: "waiting" });

  useEffect(() => {
    if (!email) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const res = await fetch(`/api/subscription?email=${encodeURIComponent(email)}`);
      const { subscription } = (await res.json()) as { subscription: { plan: string; status: string } | null };
      if (subscription?.status === "active") {
        setState({ kind: "active", plan: subscription.plan });
        clearInterval(timer);
      } else if (tries >= 20) {
        setState({ kind: "failed" });
        clearInterval(timer);
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [email]);

  if (!email) return <p>Missing email in the link.</p>;
  if (state.kind === "active") return <p role="status">Subscription active on the <strong>{state.plan}</strong> plan (test mode).</p>;
  if (state.kind === "failed")
    return <p role="status">Still waiting for the webhook. Is <code>stripe listen</code> running? See the README.</p>;
  return <p role="status">Payment received. Waiting for Stripe&apos;s webhook to confirm…</p>;
}
