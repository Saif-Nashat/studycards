import Link from "next/link";
import { WifiOff } from "lucide-react";

// Shown by the service worker when a page load is attempted with no network and
// nothing cached. Kept static and auth-free (see proxy.ts PUBLIC_PATHS) so it
// can be precached and served without a session.
export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="max-w-md mx-auto text-center py-24">
      <span className="grid place-items-center w-16 h-16 rounded-2xl mx-auto mb-5 text-[var(--color-muted)]"
        style={{ background: "var(--color-surface-2)" }}>
        <WifiOff size={28} strokeWidth={1.75} />
      </span>
      <h1 className="font-display text-3xl mb-3 tracking-tight">You&apos;re offline</h1>
      <p className="text-[var(--color-muted)] mb-6">
        MediCards can&apos;t reach the network right now. Any cards you rated while
        offline are saved on this device and will sync automatically once
        you&apos;re back online.
      </p>
      <Link href="/" className="btn btn-primary">Try again</Link>
    </div>
  );
}
