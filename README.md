# garrysykes.com

Photography portfolio and blog of Garry Sykes. Quarto website, deployed to GitHub Pages via GitHub Actions.

## Setup

```bash
uv sync
```

Also needed (Homebrew): `exiftool`, `cwebp` (`brew install webp`).

## Local preview

```bash
uv run quarto preview
```

### Preview on a phone (same Wi-Fi)

```bash
uv run quarto preview --host 0.0.0.0 --port 4200 --no-browser
ipconfig getifaddr en0                    # Mac's LAN IP, e.g. 192.168.1.232
```

On the phone (same Wi-Fi network), open `http://<LAN IP>:4200/`. `--host 0.0.0.0` makes the server
listen on all network interfaces instead of only `localhost`; a fixed `--port` keeps the URL stable.
If it won't load, allow incoming connections for Quarto/Deno when macOS asks (or in System Settings →
Network → Firewall), and check the phone isn't on a guest network or mobile data. Live reload works on
the phone too.

If `_quarto.yml` changes, re-render the whole site before previewing:

```bash
uv run quarto render
```

## Structure

```text
index.qmd              # Home: infinite-scroll photo gallery (genre filter, sort, lightbox)
projects/
  index.qmd            # grid of projects (cover, title, description)
  <slug>.qmd           # one page per project — created by scripts/photos.py
  _metadata.yml        # wires the gallery (and skip link) into every project page
blog/
  index.qmd            # post listing + RSS feed (blog/index.xml)
  posts/<YYYY-MM-DD-slug>/index.qmd   # one folder per post, images alongside
  _template/index.qmd  # template for new posts (not published)
about.qmd              # about page (trestles template): social links, obfuscated Email button, Tools of the trade
images/                # site images: favicon.ico, apple-touch-icon, about-stand, x100vi (avatar/ = gitignored sources)
photos/full|thumb|small/  # gallery webps, named by photo id (small = phone thumbnails)
data/photos.json       # published photo manifest read by the gallery
_data/                 # catalog.json + overrides.yaml (private, not published)
scripts/photos.py      # photo pipeline
assets/js/gallery.js   # gallery, tag cloud, lightbox
assets/vendor/         # PhotoSwipe 5 (vendored)
_includes/             # build-time helpers (not published) — see Customisations
styles.scss            # theme overrides on top of cosmo — see Look and feel
```

## Adding photos

1. In Lightroom Classic, set metadata on each photo:
   - **Title** = project name (e.g. `Street Photography: Leeds`); leave blank for Home-only photos
   - **Caption**, **Alt Text** (caption is used if alt text is empty)
   - **Keywords**: genres prefixed with `_` (e.g. `_street`, `_nature`) become Home filter chips; other keywords form each project's tag cloud
   - **Label `Red`** on one photo per project = the project's cover
2. Export with the website preset (1600px long edge) to `~/Desktop/Lrc_JPEGs/lightbox/`.
3. Ingest:

   ```bash
   uv run scripts/photos.py ingest            # --dry-run to preview, --no-move to keep sources
   ```

   This converts to webp, updates `data/photos.json`, creates/updates project pages, moves the
   JPEGs to `Lrc_JPEGs/completed/<date>/`, and prints a `check` report.
4. For a new project, fill in `description:` in `projects/<slug>.qmd` (you can add prose below the front matter too).
   The description is used for search results and share previews; it's hidden on the page by default
   (see [Descriptions](#descriptions)).
5. Commit and push.

Re-exporting a photo (same capture time + filename) updates it in place. New genres and projects appear automatically.

## Writing a blog post

```bash
uv run scripts/photos.py new-post "Street photography tips"     # creates blog/posts/<today>-street-photography-tips/
# export the post's JPEGs to ~/Desktop/Lrc_JPEGs/blog/ (name one cover.jpg), then:
uv run scripts/photos.py post-images <today>-street-photography-tips
```

Write the post in its `index.qmd`, reference images relatively (`![Caption](my-photo.webp)`), then remove
`draft: true` when ready. The first paragraph becomes the listing summary unless `description:` is set;
fill in `description:` anyway (1–2 sentences) — it's the search-result and share-preview text.
Post images never appear in the gallery; a gallery photo can be used via `/photos/full/<id>.webp`.

## Hiding and removing

| Item | Hide (reversible) | Remove (permanent) |
|---|---|---|
| Photo | add id to `hidden:` in `_data/overrides.yaml`, then `photos.py rebuild` | `photos.py remove <id>` |
| Project | add slug to `hidden_projects:` in `_data/overrides.yaml`, then `photos.py rebuild` (photos stay on Home) | `photos.py remove-project <slug> [--keep-images]` |
| Blog post | `draft: true` in its front matter | delete its folder |

`_data/overrides.yaml` can also correct a photo's fields without re-exporting (see comments in the file).
Hidden photos are still reachable by direct URL — use *remove* for anything that must go. Photo ids are
shown in the address bar (`#photo=<id>`) when a photo is open in the lightbox.

## Image protection

Photos are public (they're in the GitHub repo), so these only deter casual copying: thumbnails link to
`#photo=<id>` rather than the image file, right-click/drag and iOS long-press saving are blocked, every
webp carries copyright XMP (Creator, Rights, link to the About page — `photos.py stamp` re-applies it),
captions show `© Garry Sykes`, and `robots.txt` disallows AI crawlers.

`uv run scripts/photos.py check` reports missing captions/alt text, cover problems, empty project
descriptions and orphan files.

## Deploying

Commit and push to `main`; GitHub Actions renders and publishes to the `gh-pages` branch. No page
executes Python, so nothing needs rendering locally first. (`freeze: auto` remains in `_quarto.yml` for
any future page that does — render it locally and commit `_freeze/`.)

## Look and feel

All in `styles.scss` (theme overrides on cosmo; keep the `/*-- scss:defaults --*/` and
`/*-- scss:rules --*/` markers).

- **Font**: Inter, loaded from Google Fonts via `$web-font-path`.
- **Navbar**: white with a thin grey rule. Menu items left (lowercase, grey), name bold and centred,
  social + search icons right. The current section's item is blue (`$primary`, #1a66d9) — including on
  blog posts and project pages, which `_includes/a11y.html` marks because Quarto only highlights exact pages.
- **Gallery chips/tags**: neutral greys so the UI doesn't compete with the photos.
- **Scrollbar**: `html { overflow-y: scroll }` always reserves it, so the centred name sits in the same
  place on short pages and long gallery pages.
- **Dates**: no Modified dates anywhere. Published shows only on blog posts; project pages keep `date:`
  (the Projects grid sorts by it) but it's hidden by the `body:has(.pg-project)` rule.

### Descriptions

Each page's `description:` front matter becomes its `<meta name="description">` (search results,
share previews). Placeholders are marked `# TODO: rewrite`. By default descriptions are **hidden on
screen** (still read by screen readers) by this rule in `styles.scss`:

```scss
#title-block-header .description,
.quarto-grid-item .listing-description {
  @include visually-hidden;
}
```

- First line = the description under the title at the top of every page (project pages, About,
  Projects, Blog, blog posts).
- Second line = the description beneath each project's image on the Projects grid.

To show them:

| Show description… | Change |
|---|---|
| Beneath project images **and** on project pages | delete the whole rule |
| Beneath project images only | delete the first line (and its trailing comma) |
| At the top of project pages only | change the first line to `body:has(.pg-project) #title-block-header .description` |
| On project pages and beneath project images, but not other pages | change the first line as above **and** delete the second line (and the comma before it) |

Then `uv run quarto preview` to check, and commit + push. Blog listing summaries are always visible.

## SEO and accessibility

- `robots.txt` points to `https://garrysykes.com/sitemap.xml` (Quarto generates the sitemap from `site-url`).
- Every page gets a `<link rel="canonical">` to its garrysykes.com URL (`_includes/canonical.lua`).
- Home has a visually-hidden `<h1>` and Person/WebSite structured data (JSON-LD) in `index.qmd` —
  update the `sameAs` links there if social profiles change.
- Share previews: project pages use their cover; a site-wide default image is a TODO in `_quarto.yml`
  (`open-graph: {image: images/share.jpg}`, ideally a 1200×630 JPEG).
- Keyboard: "Skip to content" link on the first Tab (`_includes/skip-link.html`) and a visible blue focus ring.
- Reduced motion: transitions and lightbox zoom are disabled when the OS "reduce motion" setting is on.
- Photo alt text comes from Lightroom (Alt Text, falling back to Caption); `photos.py check` flags gaps.

## Customisations

Build-time helpers live in `_includes/` (the `_` prefix means Quarto neither renders nor publishes
them), wired up globally in `_quarto.yml`:

- **`_includes/canonical.lua`** — adds a canonical link to every page (`.html` form, matching the sitemap).
- **`_includes/skip-link.html`** — "Skip to content" link (`include-before-body`).
- **`_includes/external-links.html`** — opens links to other sites in a new tab and blocks right-click /
  drag on images.
- **`_includes/reorder-title-meta.html`** — moves the Published date directly beneath the title on pages
  with category tags (blog posts).
- **`_includes/head.html`** — preconnects to Google Fonts (Inter) and sets the iOS
  home-screen icon (`images/apple-touch-icon.png`). The favicon is `images/favicon.ico` (`favicon:` in
  `_quarto.yml`).
- **About page Email button** — the address is stored reversed + base64 in a script in `about.qmd` and
  only assembled into a `mailto:` (with subject) on click, so it never appears in the page source.
  Hidden links (GitHub, Strava, TrigpointingUK; navbar GitHub) are commented out in `about.qmd` /
  `_quarto.yml` — uncomment to restore.
- **`_includes/a11y.html`** — fixes accessibility gaps in markup Quarto generates: labels the search
  box, removes an invalid role from the mobile menu button, tidies listing links, images and heading
  levels for screen readers, and highlights the current section in the navbar on sub-pages.

`projects/_metadata.yml` repeats the HTML includes because directory-level `include-in-header` /
`include-before-body` / `include-after-body` lists replace the site-wide ones.

## Useful links

1. [Quarto: Creating a Website](https://quarto.org/docs/websites/)
2. [Quarto: Listings](https://quarto.org/docs/websites/website-listings.html)
3. [Publish to GitHub Pages](https://quarto.org/docs/publishing/github-pages.html)
4. [PhotoSwipe](https://photoswipe.com/)
