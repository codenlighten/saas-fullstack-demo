import Link from "next/link";
import { Suspense } from "react";
import { DemoBanner } from "@/components/DemoBanner";
import { SuccessStatus } from "@/components/SuccessStatus";

export default function Success() {
  return (
    <>
      <DemoBanner />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16 text-center">
        <h1 className="text-3xl font-bold">Thanks</h1>
        <div className="mt-6">
          <Suspense fallback={<p>Loading…</p>}>
            <SuccessStatus />
          </Suspense>
        </div>
        <p className="mt-8">
          <Link href="/" className="underline">
            Back to pricing
          </Link>
        </p>
      </main>
    </>
  );
}
