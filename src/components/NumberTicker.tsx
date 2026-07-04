"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useMotionValue, useTransform, motion } from "framer-motion";

// Animated counter: numbers roll up from 0 when they enter the viewport,
// which makes every stat feel earned instead of just printed. Falls back to
// the plain value for non-numeric input (e.g. "97%") by animating the number
// inside it and keeping the suffix.
export default function NumberTicker({ value, className, duration = 1.1 }: { value: number | string; className?: string; duration?: number }) {
  const numeric = typeof value === "number" ? value : parseFloat(String(value));
  const suffix = typeof value === "string" ? String(value).replace(/^[\d.,\s-]*/, "") : "";
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => `${Math.round(v).toLocaleString()}${suffix}`);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  useEffect(() => {
    if (!inView || !isFinite(numeric)) return;
    const controls = animate(mv, numeric, { duration, ease: [0.32, 0.72, 0, 1] });
    return controls.stop;
  }, [inView, numeric, mv, duration]);

  if (!isFinite(numeric)) return <span className={className}>{value}</span>;
  return <motion.span ref={ref} className={className}>{rounded}</motion.span>;
}
