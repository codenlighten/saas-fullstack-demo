/**
 * Safety guard: this project is a demo and only ever talks to Stripe in test
 * mode. A live secret key is refused outright instead of being used.
 */
export function assertTestSecretKey(key: string | undefined): string {
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set (use a Stripe test key, sk_test_...)");
  }
  if (!key.startsWith("sk_test_")) {
    throw new Error("Refusing to start: STRIPE_SECRET_KEY must be a Stripe TEST key (sk_test_...)");
  }
  return key;
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
