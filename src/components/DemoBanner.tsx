export function DemoBanner() {
  return (
    <div role="note" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
      <strong>Demo only.</strong> Stripe <strong>test mode</strong>: no real payments, no real customers. Use card{" "}
      <code className="font-mono">4242 4242 4242 4242</code>, any future expiry, any CVC.
    </div>
  );
}
