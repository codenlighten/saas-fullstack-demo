import type Stripe from "stripe";
import { PLANS, isPlanId, type PlanId } from "./plans";
import type { Store } from "./store";

/** The slice of the Stripe client we use, so tests can pass a stub. */
export interface CheckoutClient {
  checkout: {
    sessions: {
      create(params: Stripe.Checkout.SessionCreateParams): Promise<{ id: string; url: string | null }>;
    };
  };
}

export async function createCheckoutSession(
  client: CheckoutClient,
  opts: { plan: PlanId; email: string; baseUrl: string },
): Promise<{ id: string; url: string }> {
  const plan = PLANS[opts.plan];
  const session = await client.checkout.sessions.create({
    mode: "subscription",
    customer_email: opts.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: plan.currency,
          unit_amount: plan.unitAmount,
          recurring: { interval: plan.interval },
          product_data: { name: `${plan.name} (demo, test mode)` },
        },
      },
    ],
    metadata: { plan: plan.id },
    success_url: `${opts.baseUrl}/success?session_id={CHECKOUT_SESSION_ID}&email=${encodeURIComponent(opts.email)}`,
    cancel_url: `${opts.baseUrl}/#pricing`,
  });
  if (!session.url) throw new Error("Stripe returned a Checkout Session without a URL");
  return { id: session.id, url: session.url };
}

export type WebhookOutcome = "applied" | "duplicate" | "ignored";

type EventLike = Pick<Stripe.Event, "id" | "type"> & { livemode?: boolean; data: { object: unknown } };

const id = (v: string | { id: string } | null | undefined): string | null =>
  typeof v === "string" ? v : (v?.id ?? null);

/**
 * Applies a verified Stripe event to the store.
 *
 * - Atomic: claiming the event id and changing state commit together, so a crash or
 *   error cannot leave an event marked "processed" without its effect (Stripe's retry
 *   then applies it).
 * - Idempotent: each event id is applied once.
 * - Order-safe: a cancellation that arrives before its checkout event is remembered,
 *   so the late checkout event cannot resurrect the subscription.
 * - Test-mode only: events flagged livemode are refused.
 */
export function applyEvent(store: Store, event: EventLike): WebhookOutcome {
  if (event.livemode === true) return "ignored";
  return store.transaction(() => {
    if (!store.claimEvent(event.id)) return "duplicate";
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const email = s.customer_details?.email ?? s.customer_email;
        const plan = s.metadata?.plan;
        // Only grant access once Stripe says the session is paid (or needs no payment, e.g. a trial).
        if (!email || !isPlanId(plan) || s.payment_status === "unpaid") return "ignored";
        const subscriptionId = id(s.subscription as string | { id: string } | null);
        store.upsertSubscription({
          email,
          plan,
          status: subscriptionId && store.isSubscriptionCanceled(subscriptionId) ? "canceled" : "active",
          stripeCustomerId: id(s.customer as string | { id: string } | null),
          stripeSubscriptionId: subscriptionId,
        });
        return "applied";
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        return store.cancelBySubscription(sub.id) ? "applied" : "ignored";
      }
      default:
        return "ignored";
    }
  });
}
