import Stripe from "stripe";
import { assertTestSecretKey } from "./config";

let client: Stripe | undefined;

export function getStripe(): Stripe {
  client ??= new Stripe(assertTestSecretKey(process.env.STRIPE_SECRET_KEY));
  return client;
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return secret;
}
