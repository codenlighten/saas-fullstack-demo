import { DemoBanner } from "@/components/DemoBanner";
import { PricingCards } from "@/components/PricingCards";

export default function Home() {
  return (
    <>
      <DemoBanner />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Subscriptions, end to end</h1>
        <p className="mx-auto mt-4 max-w-xl text-zinc-600 dark:text-zinc-400">
          A small full-stack example: pricing page, Stripe Checkout, a signature-verified webhook and an idempotent
          subscription store. It is a portfolio demo and sells nothing.
        </p>
        <div id="pricing" className="mt-12">
          <PricingCards />
        </div>
      </main>
    </>
  );
}
