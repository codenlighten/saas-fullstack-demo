"use client";

import { useState } from "react";
import { PLANS, type PlanId } from "@/lib/plans";

function price(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

export function PricingCards() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(plan: PlanId) {
    setError(null);
    setBusy(plan);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, email }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Something went wrong.");
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  }

  return (
    <div>
      <label className="mx-auto mb-8 block max-w-sm text-left text-sm font-medium">
        Your email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <div className="grid gap-6 sm:grid-cols-2">
        {Object.values(PLANS).map((plan) => (
          <section
            key={plan.id}
            aria-labelledby={`plan-${plan.id}`}
            className="flex flex-col rounded-xl border border-zinc-200 p-6 text-left dark:border-zinc-800"
          >
            <h3 id={`plan-${plan.id}`} className="text-lg font-semibold">
              {plan.name}
            </h3>
            <p className="mt-2 text-3xl font-bold">
              {price(plan.unitAmount)}
              <span className="text-base font-normal text-zinc-500"> / {plan.interval}</span>
            </p>
            <ul className="mt-4 flex-1 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {plan.features.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
            <button
              type="button"
              disabled={busy !== null || email.length === 0}
              onClick={() => choose(plan.id)}
              className="mt-6 rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {busy === plan.id ? "Opening checkout…" : `Try ${plan.name} (test mode)`}
            </button>
          </section>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
