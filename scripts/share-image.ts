// Quarto post-render: pages using the default share image (website.image in
// _quarto.yml) get its size + alt text, so Facebook etc. can render the card
// on the very first share without fetching the image first.

const out = Deno.env.get("QUARTO_PROJECT_OUTPUT_DIR") ?? "_site";
const IMG = "https://garrysykes.com/images/share.jpg";
const EXTRA = [
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta property="og:image:alt" content="Skiddaw from High Rigg, Lake District: autumn fells above a green valley">',
].join("\n");
const TAG = `<meta property="og:image" content="${IMG}">`;

const walk = (dir: string): string[] =>
  [...Deno.readDirSync(dir)].flatMap((e) =>
    e.isDirectory ? walk(`${dir}/${e.name}`) : e.name.endsWith(".html") ? [`${dir}/${e.name}`] : []
  );

for (const file of walk(out)) {
  const html = Deno.readTextFileSync(file);
  if (!html.includes(TAG) || html.includes("og:image:width")) continue;
  Deno.writeTextFileSync(file, html.replace(TAG, `${TAG}\n${EXTRA}`));
}
