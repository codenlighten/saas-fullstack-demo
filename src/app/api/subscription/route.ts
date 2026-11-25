import { z } from "zod";
import { getStore } from "@/lib/store";

export async function GET(request: Request) {
  const email = z.email().safeParse(new URL(request.url).searchParams.get("email"));
  if (!email.success) return Response.json({ error: "Provide a valid email." }, { status: 400 });
  const sub = getStore().getSubscription(email.data);
  return Response.json({ subscription: sub ? { plan: sub.plan, status: sub.status } : null });
}
