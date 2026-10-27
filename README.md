# datapiquing.com

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
  _metadata.yml        # wires the gallery into every project page
blog/
  index.qmd            # post listing + RSS feed (blog/index.xml)
  posts/<YYYY-MM-DD-slug>/index.qmd   # one folder per post, images alongside
  _template/index.qmd  # template for new posts (not published)
about.qmd              # about page (trestles template)
photos/full|thumb/     # gallery webps, named by photo id
data/photos.json       # published photo manifest read by the gallery
_data/                 # catalog.json + overrides.yaml (private, not published)
scripts/photos.py      # photo pipeline
assets/js/gallery.js   # gallery, tag cloud, lightbox
assets/vendor/         # PhotoSwipe 5 (vendored)
_includes/             # build-time helpers (not published) — see Customisations
styles.scss            # theme overrides on top of cosmo
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
5. Commit and push.

Re-exporting a photo (same capture time + filename) updates it in place. New genres and projects appear automatically.

## Writing a blog post

```bash
uv run scripts/photos.py new-post "Street photography tips"     # creates blog/posts/<today>-street-photography-tips/
# export the post's JPEGs to ~/Desktop/Lrc_JPEGs/blog/ (name one cover.jpg), then:
uv run scripts/photos.py post-images <today>-street-photography-tips
```

Write the post in its `index.qmd`, reference images relatively (`![Caption](my-photo.webp)`), then remove
`draft: true` when ready. The first paragraph becomes the listing summary unless `description:` is set.
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

`uv run scripts/photos.py check` reports missing captions/alt text, cover problems, empty project
descriptions and orphan files.

## Deploying

Commit and push to `main`; GitHub Actions renders and publishes to the `gh-pages` branch. No page
executes Python, so nothing needs rendering locally first. (`freeze: auto` remains in `_quarto.yml` for
any future page that does — render it locally and commit `_freeze/`.)

## Customisations

Two build-time helpers live in `_includes/` (the `_` prefix means Quarto neither renders nor publishes
them), wired up globally in `_quarto.yml`:

- **`_includes/git-modified.lua`** — sets each page's `Modified` date from `git log` (the last commit that
  touched the file), because Quarto's `last-modified` is the checkout time on CI. **Requires
  `fetch-depth: 0`** on the checkout step in `.github/workflows/publish.yml`. Uncommitted files fall back
  to mtime.
- **`_includes/reorder-title-meta.html`** — moves the Published/Modified dates directly beneath the title
  on pages with category tags (blog posts). `projects/_metadata.yml` repeats it because a directory-level
  `include-after-body` replaces the site-wide one.

## Useful links

1. [Quarto: Creating a Website](https://quarto.org/docs/websites/)
2. [Quarto: Listings](https://quarto.org/docs/websites/website-listings.html)
3. [Publish to GitHub Pages](https://quarto.org/docs/publishing/github-pages.html)
4. [PhotoSwipe](https://photoswipe.com/)
