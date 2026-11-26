"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type State = { kind: "waiting" } | { kind: "active"; plan: string } | { kind: "failed" };

const POLL_MS = 1500;
const GIVE_UP_MS = 30_000;

export function SuccessStatus() {
  const email = useSearchParams().get("email");
  const [state, setState] = useState<State>({ kind: "waiting" });

  useEffect(() => {
    if (!email) return;
    const stop = () => {
      clearInterval(poll);
      clearTimeout(deadline);
    };
    const poll = setInterval(async () => {
      // A request that fails is simply tried again; the deadline below ends the waiting.
      const subscription = await fetch(`/api/subscription?email=${encodeURIComponent(email)}`)
        .then(async (res) => ((await res.json()) as { subscription?: { plan: string; status: string } | null }).subscription)
        .catch(() => null);
      // An answer that arrives after the deadline is still true, so it is still shown.
      if (subscription?.status === "active") {
        stop();
        setState({ kind: "active", plan: subscription.plan });
      }
    }, POLL_MS);
    // Independent of the requests, so one that never completes cannot keep the page waiting.
    const deadline = setTimeout(() => {
      stop();
      setState({ kind: "failed" });
    }, GIVE_UP_MS);
    return stop;
  }, [email]);

  if (!email) return <p>Missing email in the link.</p>;
  if (state.kind === "active") return <p role="status">Subscription active on the <strong>{state.plan}</strong> plan (test mode).</p>;
  if (state.kind === "failed")
    return <p role="status">Still waiting for the webhook. Is <code>stripe listen</code> running? See the README.</p>;
  return <p role="status">Payment received. Waiting for Stripe&apos;s webhook to confirm…</p>;
}
