// The .apkg importer parses decks in the browser with sql.js, whose WASM
// binary must be served as a static file. Copy it from node_modules into
// public/ so it's always the version matching the installed package.
// Runs from postinstall (see package.json), so Vercel builds get it too.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// The bundler resolves sql.js via its "browser" export, which loads
// sql-wasm-browser.wasm — that's the binary the client will request.
const src = join(root, "node_modules", "sql.js", "dist", "sql-wasm-browser.wasm");
const dest = join(root, "public", "sql-wasm-browser.wasm");

mkdirSync(join(root, "public"), { recursive: true });
copyFileSync(src, dest);
console.log("copied sql-wasm-browser.wasm -> public/");
