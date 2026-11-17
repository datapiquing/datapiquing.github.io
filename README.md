# garrysykes.com

Photography portfolio and blog of Garry Sykes. Quarto website, deployed to GitHub Pages via GitHub Actions.

## Setup

```bash
uv sync
```

Also needed (Homebrew): `exiftool`, `cwebp` + `dwebp` (`brew install webp`). Share images also use
macOS's built-in `sips`.

## Local preview

```bash
uv run quarto preview
uv run quarto preview --profile drafts    # also render draft posts in full
```

### Previewing drafts

A normal preview or render writes each `draft: true` post as a blank placeholder page, so drafts never
reach the live site. A placeholder can then stick in preview: the post opens blank and its blog-list
entry has no image or summary. Use `--profile drafts` (`_quarto-drafts.yml`, `draft-mode: visible`)
to render drafts in full; it's local only, so CI and the published site are unaffected. In the blog
list, drafts show a red **Draft** pill and a faded row.

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
  posts/<YYYY-MM-DD-slug>/index.qmd   # one folder per post, images alongside (+ share.jpg)
  _template/index.qmd  # template for new posts (not published)
about.qmd              # about page (trestles template): social links, obfuscated Email button, Tools of the trade
images/                # site images: favicon.ico, apple-touch-icon, about-stand, x100vi, share.jpg (avatar/ = gitignored sources)
photos/full|thumb|small/  # gallery webps, named by photo id (small = phone thumbnails)
photos/share/          # project share-card JPEGs, named by cover photo id
data/photos.json       # published manifest the gallery reads (built from _data/, hidden photos removed)
_data/catalog.json     # master catalogue of every ingested photo (script-owned; don't edit)
_data/overrides.yaml   # hand-edited: hidden photos/projects, per-photo field fixes
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

   This converts to webp, adds/updates the photos in `_data/catalog.json`, rebuilds the published
   manifest `data/photos.json`, creates/updates project pages and their [share images](#share-images), moves the JPEGs to
   `Lrc_JPEGs/completed/<date>/`, and prints a `check` report.
4. For a new project, fill in `description:` in `projects/<slug>.qmd` (you can add prose below the front matter too).
   The description is used for search results and share previews; it's hidden on the page by default
   (see [Descriptions](#descriptions)).
5. Commit and push.

Re-exporting a photo (same capture time + filename) updates it in place. New genres and projects appear automatically.

### Photo data files

| File | What | Edited by |
|---|---|---|
| `_data/catalog.json` | every ingested photo's metadata (master copy) | `photos.py` only |
| `_data/overrides.yaml` | hidden photos/projects, per-photo field corrections | you, then `photos.py rebuild` |
| `data/photos.json` | what the website reads: catalog + overrides, hidden photos removed, plus project list | `photos.py` only |

`_data/` isn't part of the website, but it is in the public GitHub repo (no GPS or other location
beyond City/Country is stored).

## Starting over (new curated set)

To clear the gallery of **all** photos and projects before ingesting a newly curated set:

```bash
uv run scripts/photos.py reset --dry-run      # show what would be removed
uv run scripts/photos.py reset                # asks you to type 'reset' to confirm (--yes skips)
uv run scripts/photos.py reset --keep-pages   # keep project pages as drafts instead of deleting them
```

`reset` deletes every webp in `photos/full|thumb|small/`, empties `_data/catalog.json` and
`data/photos.json`, resets `_data/overrides.yaml` to its template, and deletes the project pages
(`projects/*.qmd` except `index.qmd`). With `--keep-pages` the pages are kept as `draft: true` — if the
new set re-uses a project name (Lightroom **Title**), ingest republishes that page with its existing
description and prose; unused ones stay hidden until you delete them. It warns if a blog post uses
gallery photos (`/photos/...`), since those images would break.

Not touched: Lightroom sources in `~/Desktop/Lrc_JPEGs/completed/`, blog posts and their images, site
images. Then: export the new set → `photos.py ingest` → fill in descriptions → commit + push. Until you
push, `git restore .` undoes a reset; after pushing, old photos remain in git history.

## Writing a blog post

```bash
uv run scripts/photos.py new-post "Street photography tips"     # creates blog/posts/<today>-street-photography-tips/
# export the post's JPEGs to ~/Desktop/Lrc_JPEGs/blog/ (name one cover.jpg, at least 1200px wide), then:
uv run scripts/photos.py post-images <today>-street-photography-tips
```

To date a post other than today (e.g. writing up an earlier trip), add `--date YYYY-MM-DD`. It sets
both the folder prefix and the post's `date:`; invalid dates are rejected before anything is created.

```bash
uv run scripts/photos.py new-post "Street photography tips" --date 2026-10-03   # blog/posts/2026-10-03-street-photography-tips/
```

**Titles containing `!`:** in zsh, `!` inside double quotes triggers history expansion, so the shell
hangs at a `dquote>` prompt (Ctrl+C to escape). Use single quotes instead. Punctuation is dropped
from the folder name but kept in the title:

```bash
uv run scripts/photos.py new-post 'Quality Street - I Won a Photo Competition!' --date 2026-11-13
```

If the title also has an apostrophe, put the `!` in its own single quotes (`"\!"` would leave a
backslash in the title):

```bash
uv run scripts/photos.py new-post "I'm a Winner"'!'
```

Preview with `uv run quarto preview --profile drafts` (see [Previewing drafts](#previewing-drafts)).
Write the post in its `index.qmd`, reference images relatively (`![Caption](my-photo.webp)`), then remove
`draft: true` (or set it to `false`) when ready. The first paragraph becomes the listing summary unless `description:` is set;
fill in `description:` anyway (1–2 sentences) — it's the search-result and share-preview text.
Post images never appear in the gallery; a gallery photo can be used via `/photos/full/<id>.webp`.
`post-images` also makes the post's `share.jpg` from `cover.webp` (see [Share images](#share-images)).

## Hiding and removing

| Item | Hide (reversible) | Remove (permanent) |
|---|---|---|
| Photo | add id to `hidden:` in `_data/overrides.yaml`, then `photos.py rebuild` | `photos.py remove <id>` |
| Project | add slug to `hidden_projects:` in `_data/overrides.yaml`, then `photos.py rebuild` (photos stay on Home) | `photos.py remove-project <slug> [--keep-images]` |
| Blog post | `draft: true` in its front matter | delete its folder |
| Everything in the gallery | — | `photos.py reset [--keep-pages]` (see [Starting over](#starting-over-new-curated-set)) |

`_data/overrides.yaml` can also correct a photo's fields without re-exporting (see comments in the file).
Hidden photos are still reachable by direct URL — use *remove* for anything that must go. Photo ids are
shown in the address bar (`#photo=<id>`) when a photo is open in the lightbox.

## Image protection

Photos are public (they're in the GitHub repo), so these only deter casual copying: thumbnails link to
`#photo=<id>` rather than the image file, right-click/drag and iOS long-press saving are blocked (blog images too, including opening
the lightbox link in a new tab), every
webp carries copyright XMP (Creator, Rights, link to garrysykes.com/about.html — `photos.py stamp` re-applies it),
captions show `© Garry Sykes`, and `robots.txt` disallows AI crawlers.

`uv run scripts/photos.py check` reports missing captions/alt text, cover problems, empty project
descriptions, orphan files and share images that are missing or older than their cover.

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
- Every page gets a `<link rel="canonical">` to its garrysykes.com URL, plus matching `og:url` and
  `og:type` (`_includes/canonical.lua`). `index.html` pages use the folder URL (`/`, `/blog/`,
  `/blog/posts/<slug>/`); `scripts/sitemap.ts` rewrites the sitemap to match.
- Home has a visually-hidden `<h1>` and Person/WebSite structured data (JSON-LD) in `index.qmd` —
  update the `sameAs` links there if social profiles change.
- Share previews: see [Share images](#share-images).
- Keyboard: "Skip to content" link on the first Tab (`_includes/skip-link.html`) and a visible blue focus ring.
- Reduced motion: transitions and lightbox zoom are disabled when the OS "reduce motion" setting is on.
- Photo alt text comes from Lightroom (Alt Text, falling back to Caption); `photos.py check` flags gaps.

## Share images

When a link is shared (Facebook, WhatsApp, iMessage, LinkedIn, Slack…) the preview card shows the
page's `og:image`. Every page gets a 1200×630 JPEG (1.91:1, the size these sites expect; JPEG because
some, like LinkedIn, don't show webp), stamped with the copyright XMP and no other metadata (no GPS).

| Pages | Share image | Made by |
|---|---|---|
| Home, About, Projects listing | `images/share.jpg` (Skiddaw from High Rigg) | by hand; `image:` under `website:` in `_quarto.yml` |
| Project pages | `photos/share/<cover id>.jpg`, centre crop of the cover | `photos.py rebuild` (also run by `ingest`, `remove`, `remove-project`, `reset`) |
| Blog posts | `blog/posts/<post>/share.jpg`, centre crop of the post's `image:` webp | `photos.py post-images` or `rebuild` |
| Blog listing | newest post's cover (Quarto's choice) | — |

- Quarto puts each page's `image:` (the listing thumbnail webp) in its share tags. After rendering,
  `scripts/share-image.ts` swaps project and post pages to their JPEG and adds the image size (and alt
  text where known: project cover alt, default image alt), so cards show on a link's first share.
- Share images are made **locally** — CI doesn't run `photos.py` — so run it before committing.
  Project images are reused while the cover stays the same; unused ones are deleted. A post's
  `share.jpg` is remade when its cover is newer, and deleted if the post has no webp `image:`.
- Post covers narrower than 1200px are upscaled (soft) with a warning. Use a larger cover, or replace
  `share.jpg` by hand: it's kept while newer than the cover. (The Quality Street post's comes from the
  gallery copy of its photo, `20261017-090102-DSCF0996`, as its `cover.webp` is only 608px wide.)
- Post `share.jpg` files are published via the `blog/posts/*/share.jpg` entry in `resources:` in
  `_quarto.yml` (nothing links to them, so Quarto wouldn't copy them otherwise). A draft post with a
  cover therefore has its `share.jpg` online before the post is.
- `photos.py check` flags missing or out-of-date share images; `photos.py rebuild` fixes them.
- To change the default image, replace `images/share.jpg` (1200×630 JPEG) and update the alt text in
  `scripts/share-image.ts`.
- Test a page with Facebook's [Sharing Debugger](https://developers.facebook.com/tools/debug/) (click
  **Scrape Again** after changes; GitHub Pages caches pages for up to 10 minutes) or
  [opengraph.xyz](https://www.opengraph.xyz/). The `fb:app_id` warning can be ignored.

## Analytics

[GoatCounter](https://www.goatcounter.com/) (dashboard: <https://garrysykes.goatcounter.com>) counts page
views. It sets no cookies and stores no personal data, so no consent banner is needed. The script is
in `_includes/head.html`; visits from `localhost` (preview) aren't counted.

- **Photo views**: the gallery lightbox only changes the `#photo=<id>` hash, which GoatCounter ignores,
  so `assets/js/gallery.js` sends an event `photo/<id>` (titled "project — caption") for each photo
  viewed, opened or swiped to, once per page load. Blog post lightbox images aren't counted.
- To exclude your own visits, use GoatCounter's setting to ignore your browser.

## Customisations

Build-time helpers live in `_includes/` (the `_` prefix means Quarto neither renders nor publishes
them), wired up globally in `_quarto.yml`:

- **`_includes/canonical.lua`** — adds a canonical link, `og:url` and `og:type` to every page (see
  [SEO and accessibility](#seo-and-accessibility)).
- **`_includes/skip-link.html`** — "Skip to content" link (`include-before-body`).
- **`_includes/external-links.html`** — opens links to other sites in a new tab and blocks right-click /
  drag on images and middle/Cmd-click on blog lightbox links.
- **`_includes/reorder-title-meta.html`** — moves the Published date directly beneath the title on pages
  with category tags (blog posts).
- **`_includes/head.html`** — loads [GoatCounter](#analytics) analytics, preconnects to Google Fonts (Inter) and sets the iOS
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
