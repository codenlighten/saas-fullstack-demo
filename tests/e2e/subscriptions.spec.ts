import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import Stripe from "stripe";
import { E2E_ENV, E2E_URL } from "./env";

/*
 * The real production server and a real browser. Stripe's own service is never called: its hosted
 * checkout page is not part of these tests, and webhooks are signed here with the placeholder secret,
 * using Stripe's library, then verified by the running server exactly as a delivery from Stripe would be.
 */

const stripe = new Stripe(E2E_ENV.STRIPE_SECRET_KEY);
const someone = () => `e2e-${randomUUID()}@example.com`;

async function deliver(request: APIRequestContext, type: string, object: object, secret = E2E_ENV.STRIPE_WEBHOOK_SECRET) {
  const payload = JSON.stringify({ id: `evt_${randomUUID()}`, object: "event", type, livemode: false, data: { object } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return request.post("/api/webhooks/stripe", {
    data: payload,
    headers: { "content-type": "application/json", "stripe-signature": signature },
  });
}

const paidSession = (email: string, subscription: string) => ({
  customer: "cus_e2e",
  subscription,
  payment_status: "paid",
  customer_email: email,
  metadata: { plan: "team" },
});

const status = (page: Page) => page.getByRole("status");

test("the pricing page says it is a demo and needs an email before checkout", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("note")).toContainText("no real payments");
  await expect(page.getByRole("region", { name: "Starter" })).toContainText("$9 / month");
  await expect(page.getByRole("region", { name: "Team" })).toContainText("$29 / month");
  const choose = page.getByRole("button", { name: "Try Team (test mode)" });
  await expect(choose).toBeDisabled();
  await page.getByLabel("Your email").fill("ada@example.com");
  await expect(choose).toBeEnabled();
});

test("the server refuses an invalid email and the page says so", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your email").fill("not-an-email");
  await page.getByRole("button", { name: "Try Starter (test mode)" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "valid plan and email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try Starter (test mode)" })).toBeEnabled();
});

test("choosing a plan sends it with the email and follows the returned checkout address", async ({ page }) => {
  // The one stubbed call: with a real key this route asks Stripe for a hosted checkout page.
  let sent: unknown;
  await page.route("**/api/checkout", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { url: `${E2E_URL}/success?session_id=cs_e2e&email=ada%40example.com` } });
  });
  await page.goto("/");
  await page.getByLabel("Your email").fill("ada@example.com");
  await page.getByRole("button", { name: "Try Team (test mode)" }).click();
  await expect(page).toHaveURL(/\/success\?session_id=cs_e2e/);
  expect(sent).toEqual({ plan: "team", email: "ada@example.com" });
});

test("the success page waits, then shows the plan once a signed webhook arrives", async ({ page, request }) => {
  const email = someone();
  const subscription = `sub_${randomUUID()}`;
  await page.clock.install();
  await page.goto(`/success?email=${encodeURIComponent(email)}`);
  await expect(status(page)).toContainText("Waiting for Stripe");

  const response = await deliver(request, "checkout.session.completed", paidSession(email, subscription));
  expect(await response.json()).toEqual({ received: true, outcome: "applied" });
  await page.clock.runFor(1500);
  await expect(status(page)).toContainText("Subscription active on the team plan");
  // Once active, the give-up deadline must not take it back.
  await page.clock.runFor(60_000);
  await expect(status(page)).toContainText("Subscription active on the team plan");

  await deliver(request, "customer.subscription.deleted", { id: subscription });
  const after = await request.get(`/api/subscription?email=${encodeURIComponent(email)}`);
  expect(await after.json()).toEqual({ subscription: { plan: "team", status: "canceled" } });
});

test("a subscription that was already cancelled is not shown as active", async ({ page, request }) => {
  const email = someone();
  const subscription = `sub_${randomUUID()}`;
  // Stripe does not promise order: the cancellation arrives first.
  await deliver(request, "customer.subscription.deleted", { id: subscription });
  await deliver(request, "checkout.session.completed", paidSession(email, subscription));
  await page.clock.install();
  await page.goto(`/success?email=${encodeURIComponent(email)}`);
  // Let the page ask several times, and look at what it shows after each answer.
  for (let poll = 0; poll < 3; poll++) {
    const answered = page.waitForResponse((r) => r.url().includes("/api/subscription"));
    await page.clock.runFor(1500);
    const response = await answered;
    expect(await response.json()).toEqual({ subscription: { plan: "team", status: "canceled" } });
    await response.finished();
    await expect(status(page)).toContainText("Waiting for Stripe");
    await expect(status(page)).not.toContainText("Subscription active");
  }
});

test("a webhook signed with the wrong secret changes nothing", async ({ request }) => {
  const email = someone();
  const response = await deliver(request, "checkout.session.completed", paidSession(email, "sub_forged"), "whsec_forged");
  expect(response.status()).toBe(400);
  const unsigned = await request.post("/api/webhooks/stripe", { data: "{}" });
  expect(unsigned.status()).toBe(400);
  const lookup = await request.get(`/api/subscription?email=${encodeURIComponent(email)}`);
  expect(await lookup.json()).toEqual({ subscription: null });
});

for (const [name, answer] of [
  ["no webhook arrives", "empty"],
  ["the status request cannot be made", "offline"],
  ["the status request never completes", "hanging"],
] as const) {
  test(`the success page stops waiting and says what to check when ${name}`, async ({ page }) => {
    await page.clock.install();
    let asked = 0;
    await page.route("**/api/subscription**", (route) => {
      asked += 1;
      if (answer === "hanging") return; // held open: neither answered nor refused
      return answer === "offline" ? route.abort() : route.fulfill({ json: { subscription: null } });
    });
    await page.goto(`/success?email=${encodeURIComponent(someone())}`);
    await expect(status(page)).toContainText("Waiting for Stripe");
    for (let i = 0; i < 25; i++) await page.clock.runFor(1500);
    await expect(status(page)).toContainText("Still waiting for the webhook");
    const stopped = asked;
    await page.clock.runFor(15_000);
    expect(asked).toBe(stopped);
    expect(stopped).toBeGreaterThanOrEqual(19);
  });
}

test("a success link without an email explains itself", async ({ page }) => {
  await page.goto("/success");
  await expect(page.getByText("Missing email in the link.")).toBeVisible();
});

for (const path of ["/", "/success?email=a-very-long-address-for-a-narrow-screen%40example.com"]) {
  test(`no sideways scroll on a 320px screen: ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(path);
    await expect(page.getByRole("note")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
}
