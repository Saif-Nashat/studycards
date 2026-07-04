import Link from "next/link";
import { Home, Compass } from "lucide-react";

// Friendly 404 for logged-in users who hit a URL that doesn't exist.
export default function NotFound() {
  return (
    <div className="grid place-items-center py-20">
      <div className="card-surface gradient-ring p-8 md:p-10 max-w-md text-center fade-up">
        <div className="mx-auto mb-4 grid place-items-center w-14 h-14 rounded-2xl bg-[var(--color-tint)] text-[var(--color-brand)]">
          <Compass size={26} />
        </div>
        <h1 className="font-display text-2xl mb-2">Page not found</h1>
        <p className="text-sm text-[var(--color-muted)] leading-relaxed">
          This page doesn&apos;t exist (or moved). Your decks are still right where you
          left them.
        </p>
        <div className="flex items-center justify-center mt-6">
          <Link href="/" className="btn btn-primary">
            <Home size={16} /> Back to my decks
          </Link>
        </div>
      </div>
    </div>
  );
}
