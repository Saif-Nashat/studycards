// Owns a running .apkg import OUTSIDE React. The import used to live inside
// the Import page's component state, so its progress (and the user's sense
// that anything was still happening) was lost the moment they navigated away.
// A module-level singleton survives client-side navigation — the parsing and
// batch uploads (src/lib/apkgClient.ts) keep running wherever the user goes,
// and any component can subscribe to progress via useImportState().
//
// What still genuinely stops an import: closing the tab or a full page
// reload — the browser kills the JS. While an import runs we register a
// beforeunload prompt so that can't happen by accident; and because the
// server skips cards that already made it in, re-running the same file
// afterwards resumes losslessly.

import { useSyncExternalStore } from "react";
import { importApkgFile, ApkgImportError, type ApkgProgress, type ApkgResult } from "./apkgClient";

export type ImportState =
  | { status: "idle" }
  | { status: "running"; fileName: string; deckName: string; progress: ApkgProgress | null }
  | { status: "done"; result: ApkgResult }
  | { status: "error"; message: string; addedSoFar: number };

const IDLE: ImportState = { status: "idle" };
let state: ImportState = IDLE;
const listeners = new Set<() => void>();

function setState(next: ImportState) {
  state = next;
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useImportState(): ImportState {
  return useSyncExternalStore(subscribe, () => state, () => IDLE);
}

function warnBeforeUnload(e: BeforeUnloadEvent) {
  // Triggers the browser's "leave site?" prompt — closing the tab is the one
  // thing that would actually kill a running import.
  e.preventDefault();
  e.returnValue = "";
}

export function startImport(file: File, deckName: string) {
  if (state.status === "running") return;
  const name = (deckName || file.name.replace(/\.apkg$/i, "") || "Imported deck").trim();
  setState({ status: "running", fileName: file.name, deckName: name, progress: null });
  window.addEventListener("beforeunload", warnBeforeUnload);
  importApkgFile(file, deckName, (progress) => {
    if (state.status === "running") setState({ ...state, progress });
  })
    .then((result) => setState({ status: "done", result }))
    .catch((e: unknown) => {
      if (e instanceof ApkgImportError) {
        setState({ status: "error", message: e.message, addedSoFar: e.addedSoFar });
      } else {
        setState({
          status: "error",
          message: "Something went wrong reading that deck. Try again — if it keeps failing, re-export it from Anki with 'Support older Anki versions' ticked.",
          addedSoFar: 0,
        });
      }
    })
    .finally(() => window.removeEventListener("beforeunload", warnBeforeUnload));
}

// Clear a finished (done/error) state, e.g. from the status pill's ✕ or when
// starting to pick a new file. A running import can't be dismissed.
export function dismissImport() {
  if (state.status !== "running") setState(IDLE);
}
