"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Lock, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("That password didn't work. Try again.");
    }
  }

  return (
    <div className="min-h-[80vh] grid place-items-center">
      <div className="w-full max-w-sm fade-up">
        <div className="flex flex-col items-center mb-6">
          <span className="logo-badge float pulse-glow grid place-items-center w-16 h-16 rounded-2xl text-white mb-3">
            <GraduationCap size={32} />
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight"><span className="text-gradient">StudyCards</span></h1>
          <p className="text-[var(--color-muted)] text-sm">Your private MRCOG &amp; USMLE flashcards</p>
        </div>

        <form onSubmit={submit} className="card-surface gradient-ring p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
              <Lock size={14} /> Password
            </span>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoFocus
            />
          </label>
          {error && <p className="text-sm text-[var(--color-again)]">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : "Log in"}
          </button>
        </form>
        <p className="text-center text-xs text-[var(--color-muted)] mt-4">
          Need help getting in? Contact support on <b>0792704886</b>.
        </p>
      </div>
    </div>
  );
}
