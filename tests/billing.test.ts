import { describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { applyEvent, createCheckoutSession, type CheckoutClient } from "@/lib/billing";
import { assertTestSecretKey } from "@/lib/config";
import { createSqliteStore } from "@/lib/store";

const completed = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  type: "checkout.session.completed" as const,
  data: {
    object: {
      customer: "cus_1",
      subscription: "sub_1",
      payment_status: "paid",
      customer_email: "Ada@Example.com",
      metadata: { plan: "team" },
      ...over,
    },
  },
});

describe("test-key guard", () => {
  it("accepts sk_test_ keys", () => {
    expect(assertTestSecretKey("sk_test_abc")).toBe("sk_test_abc");
  });
  it("refuses live, restricted and missing keys", () => {
    expect(() => assertTestSecretKey("sk_live_abc")).toThrow(/TEST key/);
    expect(() => assertTestSecretKey("rk_live_abc")).toThrow(/TEST key/);
    expect(() => assertTestSecretKey(undefined)).toThrow(/not set/);
  });
});

describe("createCheckoutSession", () => {
  it("sends a subscription session with test-labelled product and the plan in metadata", async () => {
    const create = vi.fn().mockResolvedValue({ id: "cs_1", url: "https://checkout.test/cs_1" });
    const client = { checkout: { sessions: { create } } } as CheckoutClient;
    const out = await createCheckoutSession(client, { plan: "team", email: "a@b.co", baseUrl: "http://x" });
    expect(out.url).toBe("https://checkout.test/cs_1");
    const params = create.mock.calls[0][0];
    expect(params.mode).toBe("subscription");
    expect(params.metadata).toEqual({ plan: "team" });
    expect(params.line_items[0].price_data.unit_amount).toBe(2900);
    expect(params.line_items[0].price_data.product_data.name).toContain("test mode");
  });
  it("fails loudly when Stripe returns no URL", async () => {
    const create = vi.fn().mockResolvedValue({ id: "cs_1", url: null });
    await expect(
      createCheckoutSession({ checkout: { sessions: { create } } } as CheckoutClient, {
        plan: "starter",
        email: "a@b.co",
        baseUrl: "http://x",
      }),
    ).rejects.toThrow(/without a URL/);
  });
});

describe("applyEvent", () => {
  it("activates a subscription and normalises the email", () => {
    const store = createSqliteStore();
    expect(applyEvent(store, completed("evt_1"))).toBe("applied");
    expect(store.getSubscription("ada@example.com")).toMatchObject({ plan: "team", status: "active" });
  });

  it("is idempotent: a replayed event id changes nothing", () => {
    const store = createSqliteStore();
    applyEvent(store, completed("evt_1"));
    store.cancelBySubscription("sub_1");
    expect(applyEvent(store, completed("evt_1"))).toBe("duplicate");
    expect(store.getSubscription("ada@example.com")?.status).toBe("canceled");
  });

  it("cancels on customer.subscription.deleted", () => {
    const store = createSqliteStore();
    applyEvent(store, completed("evt_1"));
    const out = applyEvent(store, {
      id: "evt_2",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1", customer: "cus_1" } },
    });
    expect(out).toBe("applied");
    expect(store.getSubscription("ada@example.com")?.status).toBe("canceled");
  });

  it("ignores unknown plans, missing emails and unrelated event types", () => {
    const store = createSqliteStore();
    expect(applyEvent(store, completed("e1", { metadata: { plan: "enterprise" } }))).toBe("ignored");
    expect(applyEvent(store, completed("e2", { customer_email: null }))).toBe("ignored");
    expect(applyEvent(store, { id: "e3", type: "invoice.paid", data: { object: {} } })).toBe("ignored");
    expect(store.getSubscription("ada@example.com")).toBeNull();
  });

  it("is atomic: if handling throws, the claim rolls back too, so Stripe's retry applies the event", () => {
    const store = createSqliteStore();
    const original = store.upsertSubscription;
    let fail = true;
    store.upsertSubscription = (rec) => {
      if (fail) throw new Error("db down");
      original(rec);
    };
    expect(() => applyEvent(store, completed("evt_1"))).toThrow("db down");
    fail = false;
    expect(applyEvent(store, completed("evt_1"))).toBe("applied");
  });

  it("is order-safe: a cancellation that arrives first is not undone by the late checkout event", () => {
    const store = createSqliteStore();
    applyEvent(store, {
      id: "evt_del",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1", customer: "cus_1" } },
    });
    expect(applyEvent(store, completed("evt_late"))).toBe("applied");
    expect(store.getSubscription("ada@example.com")?.status).toBe("canceled");
  });

  it("does not cancel a newer subscription when an older one is deleted", () => {
    const store = createSqliteStore();
    applyEvent(store, completed("evt_1", { subscription: "sub_new" }));
    applyEvent(store, {
      id: "evt_2",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_old", customer: "cus_1" } },
    });
    expect(store.getSubscription("ada@example.com")?.status).toBe("active");
  });

  it("refuses live-mode events and unpaid sessions", () => {
    const store = createSqliteStore();
    expect(applyEvent(store, { ...completed("evt_live"), livemode: true })).toBe("ignored");
    expect(applyEvent(store, completed("evt_unpaid", { payment_status: "unpaid" }))).toBe("ignored");
    expect(store.getSubscription("ada@example.com")).toBeNull();
  });
});

describe("webhook signatures (real Stripe verification, no network)", () => {
  const stripe = new Stripe("sk_test_unused");
  const secret = "whsec_test_secret";
  const payload = JSON.stringify({ id: "evt_9", object: "event", type: "invoice.paid", data: { object: {} } });

  it("accepts a correctly signed payload", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(stripe.webhooks.constructEvent(payload, header, secret).id).toBe("evt_9");
  });
  it("rejects a tampered payload and a wrong secret", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(() => stripe.webhooks.constructEvent(payload + " ", header, secret)).toThrow();
    expect(() => stripe.webhooks.constructEvent(payload, header, "whsec_other")).toThrow();
  });
});
