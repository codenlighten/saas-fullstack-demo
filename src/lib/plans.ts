export type PlanId = "starter" | "team";

export interface Plan {
  id: PlanId;
  name: string;
  /** Price in the smallest currency unit (cents). */
  unitAmount: number;
  currency: "usd";
  interval: "month";
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    unitAmount: 900,
    currency: "usd",
    interval: "month",
    features: ["1 project", "Community support", "Export to CSV"],
  },
  team: {
    id: "team",
    name: "Team",
    unitAmount: 2900,
    currency: "usd",
    interval: "month",
    features: ["Unlimited projects", "Priority support", "Shared workspaces"],
  },
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && Object.hasOwn(PLANS, value);
}
