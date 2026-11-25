import { applyEvent } from "@/lib/billing";
import { getStore } from "@/lib/store";
import { getStripe, getWebhookSecret } from "@/lib/stripe";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature." }, { status: 400 });

  // The signature covers the exact raw bytes, so read the body as text and never re-serialise it.
  const raw = await request.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, getWebhookSecret());
  } catch {
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    const outcome = applyEvent(getStore(), event);
    return Response.json({ received: true, outcome });
  } catch (err) {
    console.error("webhook handling failed", event.id, err);
    return Response.json({ error: "Handler failed; Stripe will retry." }, { status: 500 });
  }
}
