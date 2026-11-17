// Quarto post-render: tidy Open Graph share images.
//
// - Project pages: Quarto uses the page `image:` (cover thumbnail webp, also
//   the listing card). Swap og:image/twitter:image for the cover's 1200x630
//   JPEG from photos.py (photos/share/, recorded in data/photos.json), since
//   some apps (LinkedIn) don't show webp.
// - Blog posts: likewise swap to the post folder's share.jpg (1200x630, made
//   by photos.py from the post's `image:`) when there is one.
// - Pages with a known share image (default website.image, project JPEGs) get
//   its size + alt text, so Facebook etc. render the card on the very first
//   share without fetching the image first.

const out = Deno.env.get("QUARTO_PROJECT_OUTPUT_DIR") ?? "_site";
const SITE = "https://garrysykes.com/";

type Share = { url: string; w: number; h: number; alt: string; escaped?: boolean };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const DEFAULT: Share = {
  url: `${SITE}images/share.jpg`,
  w: 1200,
  h: 630,
  alt: "Skiddaw from High Rigg, Lake District: autumn fells above a green valley",
};

// Project page -> its cover share JPEG.
const projectShares = new Map<string, Share>();
try {
  const manifest = JSON.parse(Deno.readTextFileSync(`${out}/data/photos.json`));
  const alt = new Map<string, string>(manifest.photos.map((p: any) => [p.id, p.alt ?? ""]));
  for (const proj of manifest.projects) {
    if (!proj.share) continue;
    projectShares.set(`${out}/projects/${proj.slug}.html`, {
      url: SITE + proj.share.file,
      w: proj.share.w,
      h: proj.share.h,
      alt: alt.get(proj.cover) ?? proj.title,
    });
  }
} catch {
  // no manifest (partial render): project pages keep Quarto's image
}

const walk = (dir: string): string[] =>
  [...Deno.readDirSync(dir)].flatMap((e) =>
    e.isDirectory ? walk(`${dir}/${e.name}`) : e.name.endsWith(".html") ? [`${dir}/${e.name}`] : []
  );

// Post share.jpg is always 1200x630; alt only if the page gave one.
const postShare = (file: string): Share | undefined => {
  const m = file.match(/\/blog\/posts\/([^/]+)\/index\.html$/);
  if (!m) return;
  try {
    Deno.statSync(file.replace(/index\.html$/, "share.jpg"));
  } catch {
    return;
  }
  const html = Deno.readTextFileSync(file);
  const alt = html.match(/<meta property="og:image:alt" content="([^"]*)">/)?.[1] ?? "";
  return { url: `${SITE}blog/posts/${m[1]}/share.jpg`, w: 1200, h: 630, alt, escaped: true };
};

const OG = /<meta property="og:image" content="[^"]*">/;
const TW = /<meta name="twitter:image" content="[^"]*">/;

for (const file of walk(out)) {
  let html = Deno.readTextFileSync(file);
  if (!OG.test(html) || html.includes("og:image:width")) continue;
  html = html.replace(/<meta property="og:image:alt" content="[^"]*">\n?/, ""); // re-added below
  let share = projectShares.get(file) ?? postShare(file);
  if (share) {
    html = html
      .replace(OG, `<meta property="og:image" content="${share.url}">`)
      .replace(TW, `<meta name="twitter:image" content="${share.url}">`);
  } else if (html.includes(`<meta property="og:image" content="${DEFAULT.url}">`)) {
    share = DEFAULT;
  } else {
    continue; // page's own image (blog covers): size unknown, leave as is
  }
  html = html.replace(OG, (tag) =>
    [
      tag,
      `<meta property="og:image:width" content="${share.w}">`,
      `<meta property="og:image:height" content="${share.h}">`,
      share.alt ? `<meta property="og:image:alt" content="${share.escaped ? share.alt : esc(share.alt)}">` : "",
    ].filter(Boolean).join("\n")
  );
  Deno.writeTextFileSync(file, html);
}
