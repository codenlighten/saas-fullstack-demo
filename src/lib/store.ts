import { DatabaseSync } from "node:sqlite";
import type { PlanId } from "./plans";

export type SubscriptionStatus = "active" | "canceled";

export interface SubscriptionRecord {
  email: string;
  plan: PlanId;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  updatedAt: string;
}

/** Storage boundary: the billing logic depends on this, not on SQLite. */
export interface Store {
  /** Runs fn atomically: if it throws, every change made inside it is rolled back. */
  transaction<T>(fn: () => T): T;
  /** Returns true if the event id was new (and is now recorded), false if already processed. */
  claimEvent(eventId: string): boolean;
  upsertSubscription(rec: Omit<SubscriptionRecord, "updatedAt">): void;
  /** Records a cancellation by Stripe subscription id, even if no checkout row exists yet. */
  cancelBySubscription(stripeSubscriptionId: string): boolean;
  isSubscriptionCanceled(stripeSubscriptionId: string): boolean;
  getSubscription(email: string): SubscriptionRecord | null;
}

export function createSqliteStore(path = ":memory:"): Store {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      email TEXT PRIMARY KEY,
      plan TEXT NOT NULL,
      status TEXT NOT NULL,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS subscriptions_sub ON subscriptions(stripe_subscription_id);
    CREATE TABLE IF NOT EXISTS canceled_subscriptions (id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS processed_events (
      id TEXT PRIMARY KEY,
      received_at TEXT NOT NULL
    );
  `);

  const claim = db.prepare("INSERT OR IGNORE INTO processed_events (id, received_at) VALUES (?, ?)");
  const upsert = db.prepare(`
    INSERT INTO subscriptions (email, plan, status, stripe_customer_id, stripe_subscription_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      plan = excluded.plan,
      status = excluded.status,
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      updated_at = excluded.updated_at
  `);
  const markCanceled = db.prepare("INSERT OR IGNORE INTO canceled_subscriptions (id) VALUES (?)");
  const isCanceled = db.prepare("SELECT 1 AS x FROM canceled_subscriptions WHERE id = ?");
  const cancelRows = db.prepare(
    "UPDATE subscriptions SET status = 'canceled', updated_at = ? WHERE stripe_subscription_id = ? AND status <> 'canceled'",
  );
  const get = db.prepare(
    "SELECT email, plan, status, stripe_customer_id AS stripeCustomerId, stripe_subscription_id AS stripeSubscriptionId, updated_at AS updatedAt FROM subscriptions WHERE email = ?",
  );

  return {
    transaction(fn) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const out = fn();
        db.exec("COMMIT");
        return out;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
    claimEvent(id) {
      return Number(claim.run(id, new Date().toISOString()).changes) === 1;
    },
    upsertSubscription(rec) {
      upsert.run(rec.email.toLowerCase(), rec.plan, rec.status, rec.stripeCustomerId, rec.stripeSubscriptionId, new Date().toISOString());
    },
    cancelBySubscription(subId) {
      markCanceled.run(subId);
      return Number(cancelRows.run(new Date().toISOString(), subId).changes) > 0;
    },
    isSubscriptionCanceled(subId) {
      return isCanceled.get(subId) !== undefined;
    },
    getSubscription(email) {
      return (get.get(email.toLowerCase()) as unknown as SubscriptionRecord | undefined) ?? null;
    },
  };
}

const globalForStore = globalThis as unknown as { __demoStore?: Store };
/** One store per server process (kept on globalThis so dev hot-reload and separate route bundles share it). */
export function getStore(): Store {
  globalForStore.__demoStore ??= createSqliteStore(process.env.DATABASE_PATH ?? ":memory:");
  return globalForStore.__demoStore;
}
