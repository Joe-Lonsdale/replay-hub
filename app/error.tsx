"use client";

export default function ErrorPage({ error }: { error: Error }) {
  return (
    <div>
      <h1 className="text-3xl tracking-tight">Something in the ledger failed</h1>
      <p className="mt-3 max-w-xl text-muted">{error.message}</p>
    </div>
  );
}
