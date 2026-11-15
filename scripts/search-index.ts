// Quarto post-render: tidy the site search index (search.json).
// Runs under Quarto's bundled Deno, so CI needs nothing extra.
//
// - Quarto indexes <main> text, which starts with the skip link: strip its
//   "Skip to content" from every entry, plus listings' hidden "No matching items".
// - Project galleries are rendered by JS, so their pages have no indexable
//   text; use the page's meta description instead (kept visually hidden on
//   the page itself).
// - Drop entries whose page no longer exists (stale incremental renders).

const out = Deno.env.get("QUARTO_PROJECT_OUTPUT_DIR") ?? "_site";
const path = `${out}/search.json`;

type Doc = { href: string; text: string; [k: string]: unknown };

let docs: Doc[];
try {
  docs = JSON.parse(Deno.readTextFileSync(path));
} catch {
  Deno.exit(0); // no index (e.g. search disabled): nothing to do
}

const SKIP = /^\s*Skip to content\s*/;
const NO_MATCH = /\s*No matching items\s*/g;

// Description from the page's <meta name="description"> (already HTML-escaped,
// matching how Quarto stores entry text).
const description = (file: string): string => {
  const html = Deno.readTextFileSync(file);
  return html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
};

const exists = (file: string): boolean => {
  try {
    return Deno.statSync(file).isFile;
  } catch {
    return false;
  }
};

const tidy = docs.flatMap((doc) => {
  const file = `${out}/${doc.href.split("#")[0]}`;
  if (!exists(file)) return [];
  let text = doc.text.replace(SKIP, "").replace(NO_MATCH, "\n").trim();
  if (!text && !doc.href.includes("#")) text = description(file);
  return [{ ...doc, text }];
});

Deno.writeTextFileSync(path, JSON.stringify(tidy, null, 2));
