"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GraduationCap, Lock, Loader2, Eye, EyeOff, ArrowRight, Sparkles, User } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("That username or password didn't work. Try again.");
    }
  }

  return (
    <div className="min-h-[86vh] grid place-items-center relative">
      {/* Local glow field behind the card — soft, slow, expensive. */}
      <motion.div
        aria-hidden
        className="absolute w-[30rem] h-[30rem] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(closest-side, var(--blob-1), transparent 70%)", filter: "blur(40px)" }}
        animate={{ x: [-60, 40, -60], y: [-30, 30, -30], scale: [1, 1.15, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute w-[22rem] h-[22rem] rounded-full pointer-events-none translate-x-40 translate-y-24"
        style={{ background: "radial-gradient(closest-side, var(--blob-3), transparent 70%)", filter: "blur(40px)" }}
        animate={{ x: [40, -30, 40], y: [20, -30, 20] }}
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 26, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
        className="w-full max-w-sm relative"
      >
        <div className="flex flex-col items-center mb-7">
          <motion.span
            initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 16, delay: 0.15 }}
            className="logo-badge float grid place-items-center w-16 h-16 rounded-2xl text-white mb-4"
          >
            <GraduationCap size={32} />
          </motion.span>
          <span className="eyebrow mb-3"><Sparkles size={10} /> Private study suite</span>
          <h1 className="font-display text-4xl tracking-tight">
            <span className="text-gradient">StudyCards</span>
          </h1>
          <p className="text-[var(--color-muted)] text-sm mt-1.5">Your private MRCOG &amp; USMLE flashcards</p>
        </div>

        {/* Double-bezel shell: a soft outer tray holding the glass form. */}
        <div className="rounded-[1.8rem] p-1.5 border border-[var(--color-hairline)] bg-[color-mix(in_srgb,var(--color-surface)_38%,transparent)] shadow-[0_30px_80px_-40px_var(--shadow-key)]">
          <form onSubmit={submit} className="card-surface gradient-ring p-6 space-y-4 !rounded-[1.45rem]">
            <label className="block">
              <span className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
                <User size={13} strokeWidth={1.75} /> Username
              </span>
              <input
                type="text"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your username"
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
                <Lock size={13} strokeWidth={1.75} /> Password
              </span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} strokeWidth={1.75} /> : <Eye size={17} strokeWidth={1.75} />}
                </button>
              </div>
            </label>
            {error && (
              <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-[var(--color-again)]">
                {error}
              </motion.p>
            )}
            <button type="submit" className="btn btn-primary w-full py-3" disabled={loading}>
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  Enter your library
                  <span className="btn-orb"><ArrowRight size={13} /></span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[var(--color-muted)] mt-5">
          Need help getting in? Contact support on <b>0792704886</b>.
        </p>
      </motion.div>
    </div>
  );
}
