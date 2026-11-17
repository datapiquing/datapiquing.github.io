// Quarto post-render: sitemap.xml lists home/section pages as ".../index.html",
// but their canonical URL (_includes/canonical.lua) is the folder ("/", "/blog/").
// Rewrite the entries to match, so search engines see one URL per page.

const out = Deno.env.get("QUARTO_PROJECT_OUTPUT_DIR") ?? "_site";
const path = `${out}/sitemap.xml`;

let xml: string;
try {
  xml = Deno.readTextFileSync(path);
} catch {
  Deno.exit(0); // no sitemap (partial render): nothing to do
}

Deno.writeTextFileSync(path, xml.replace(/\/index\.html<\/loc>/g, "/</loc>"));
