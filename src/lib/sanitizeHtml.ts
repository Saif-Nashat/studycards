// Defence-in-depth sanitiser for the notebook's rich-text HTML. The notebook
// is private to its owner (so nobody can inject into anyone else's), but
// content pasted from a webpage could smuggle active markup in — this strips
// anything executable before it's stored, keeping only formatting.
const DANGEROUS_TAGS = /<\s*\/?\s*(script|style|iframe|object|embed|link|meta|form|base|svg|math)\b[^>]*>/gi;
const EVENT_HANDLERS = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URLS = /(href|src|xlink:href|formaction)\s*=\s*(["']?)\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^"'>\s]*\2/gi;

export function sanitizeHtml(html: string): string {
  let out = String(html);
  // A few passes, since stripping one layer can expose another
  // (e.g. <scr<script>ipt>).
  for (let i = 0; i < 3; i++) {
    const before = out;
    out = out
      .replace(DANGEROUS_TAGS, "")
      .replace(EVENT_HANDLERS, "")
      .replace(JS_URLS, '$1="#"');
    if (out === before) break;
  }
  return out;
}
