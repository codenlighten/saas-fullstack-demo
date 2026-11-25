import { z } from "zod";
import { appUrl } from "@/lib/config";
import { createCheckoutSession } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";

const Body = z.object({
  plan: z.enum(["starter", "team"]),
  email: z.email().max(254),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Provide a valid plan and email." }, { status: 400 });
  }
  try {
    const session = await createCheckoutSession(getStripe(), { ...parsed.data, baseUrl: appUrl() });
    return Response.json({ url: session.url });
  } catch (err) {
    console.error("checkout failed", err);
    return Response.json({ error: "Could not start checkout." }, { status: 502 });
  }
}
