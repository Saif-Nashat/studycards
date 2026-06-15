// Human-readable byte sizes, e.g. 7.8 MB, 512 KB, 1.2 GB.
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export interface StorageUsage {
  usedBytes: number;
  limitBytes: number;
  limitMb: number;
  pct: number;
  level: "ok" | "warn" | "critical";
  decks: { id: string; name: string; cards: number; bytes: number }[];
}
