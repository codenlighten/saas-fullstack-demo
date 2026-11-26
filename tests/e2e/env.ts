/** Placeholder settings for the browser tests. They are not Stripe keys and open nothing. */
export const E2E_URL = "http://localhost:4174";
export const E2E_ENV = {
  STRIPE_SECRET_KEY: "sk_test_e2e_placeholder",
  STRIPE_WEBHOOK_SECRET: "whsec_e2e_placeholder",
  APP_URL: E2E_URL,
};
