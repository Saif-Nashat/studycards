"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, Home, CloudOff } from "lucide-react";

// Friendly catch-all for unexpected errors inside a page. The root layout
// (nav, theme, fonts) stays up; only the page content is replaced.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Surfaces the real error in the browser console / Vercel logs while the
    // user only sees the friendly card below.
    console.error(error);
  }, [error]);

  return (
    <div className="grid place-items-center py-20">
      <div className="card-surface gradient-ring p-8 md:p-10 max-w-md text-center fade-up">
        <div className="mx-auto mb-4 grid place-items-center w-14 h-14 rounded-2xl bg-[var(--color-tint)] text-[var(--color-brand)]">
          <CloudOff size={26} />
        </div>
        <h1 className="font-display text-2xl mb-2">Something went wrong</h1>
        <p className="text-sm text-[var(--color-muted)] leading-relaxed">
          Don&apos;t worry — your cards and progress are safe. This was a hiccup on our
          side, not something you did. It often helps to simply try again.
        </p>
        {error.digest && (
          <p className="text-xs text-[var(--color-muted)] mt-2">Error code: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => unstable_retry()} className="btn btn-primary">
            <RefreshCw size={16} /> Try again
          </button>
          <Link href="/" className="btn btn-ghost">
            <Home size={16} /> Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
