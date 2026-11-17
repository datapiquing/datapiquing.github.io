# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Quarto website deployed to GitHub Pages via GitHub Actions: **photography portfolio + blog** of Garry Sykes. Home is a photo gallery, Projects are metadata-driven photo galleries, Blog is dated posts, plus About. Custom domain: garrysykes.com (set in `CNAME` + `site-url`).

## Commands

```bash
uv sync                                   # setup (also needs exiftool + cwebp via Homebrew)
uv run quarto preview                     # live preview
uv run quarto preview --profile drafts    # preview with draft posts fully rendered (_quarto-drafts.yml)
uv run quarto render                      # build site

uv run scripts/photos.py ingest           # LrC exports -> webp + manifest + project pages
uv run scripts/photos.py rebuild          # after editing _data/overrides.yaml
uv run scripts/photos.py check            # metadata/file issues
uv run scripts/photos.py stamp            # re-embed copyright XMP in all webps
uv run scripts/photos.py thumbs           # create missing small thumbnails from full webps
uv run scripts/photos.py remove <id>      # / remove-project <slug> [--keep-images]
uv run scripts/photos.py reset            # delete ALL gallery photos/projects [--dry-run] [--yes] [--keep-pages]
uv run scripts/photos.py new-post "<title>" [--date YYYY-MM-DD]   # default today; sets folder prefix + date:
uv run scripts/photos.py post-images <post-folder>
```

## Architecture

- **Deployed via GitHub Actions** — on push to `main`, the Quarto Publish workflow (Quarto 1.5.56) renders and pushes to `gh-pages`. No page executes Python, so CI renders everything; `freeze: auto` stays for any future executing page (render locally, commit `_freeze/`).
- **Photo pipeline** (`scripts/photos.py`, stdlib + PyYAML, shells out to exiftool and cwebp):
  - Source: `~/Desktop/Lrc_JPEGs/lightbox/*.jpg` (1600px LrC exports). Thumbnails are derived (`thumb` 600px high, `small` 300px high for phones/1x screens, chosen via `srcset`); LrC `thumbnail/` exports are ignored but moved with sources to `Lrc_JPEGs/completed/<date>/`.
  - Photo id = `YYYYMMDD-HHMMSS-<filename stem>` from DateTimeOriginal → re-exports upsert; ids name `photos/full|thumb|small/<id>.webp`.
  - `_data/catalog.json` (script-owned, every photo) + `_data/overrides.yaml` (hand-edited: `hidden`, `hidden_projects`, per-id field overrides) → `data/photos.json` (published manifest: `photos`, `projects`). `_data/` is not published on the site but is in the public repo.
  - Metadata mapping: Title = project, Caption/Description = caption, AltTextAccessibility = alt (falls back to caption), Keywords with `_` prefix = genres, other keywords = tag cloud, Label `Red` = project cover.
  - **Privacy**: GPS never written to the manifest; webps carry only copyright XMP (`stamp`, run automatically on ingest/post-images). Location shown is City/Country only.
  - **Download deterrence**: thumbnails link to `#photo=<id>` not the file; right-click/drag blocked, plus middle/Cmd/Ctrl/Shift-click on blog lightbox links (`a.lightbox`, which href the file) (`_includes/external-links.html`); `-webkit-touch-callout`/`user-drag` disabled in `styles.scss`; AI crawlers disallowed in `robots.txt`.
  - Project pages `projects/<slug>.qmd` are created if missing; the script only rewrites their `image:`, `date:` and `draft:` front-matter lines — title, description and prose are the user's.
- **Gallery** (`assets/js/gallery.js`, ES module): fetches `data/photos.json` (paths resolved from the module URL so any page depth works). `#pg-home` → genre chips (single-select + All) + sort + justified grid + infinite scroll; `.pg-project[data-project]` → keyword list (single-select; A-Z, uniform size, photo count in brackets; keywords on ≥90% of photos hidden; "show:" label + "all" first; collapsed to 2 rows (3 on phones) by hiding whole tail tags (never the selected one) behind an inline "+N more"/"less" toggle) + grid. Lightbox is PhotoSwipe 5 vendored in `assets/vendor/photoswipe/`; each photo viewed (open/swipe, once per page load) sends a GoatCounter event `photo/<id>` titled project — caption. Filter state in query string; `#photo=<id>` deep links. Justified rows are CSS (`--r` aspect ratio per item) in `styles.scss`; `fitLastRow` lets last-row items grow up to the median row height (`--cap-h`, `.pg-fit`/`.pg-last`) so the final row isn't smaller than the rest (worst on phones).
- **Sections**:
  - `index.qmd` — Home gallery (title block hidden via CSS)
  - `projects/index.qmd` — Quarto grid listing of `projects/*.qmd`; `projects/_metadata.yml` injects gallery script/CSS (and repeats the site-wide `include-in-header`/`include-after-body` entries, since directory-level lists replace them)
  - `blog/index.qmd` — listing of `blog/posts/*/index.qmd` + RSS; `draft` in listing `fields` → `.listing-draft` ("true", or blank for `draft: false`); inline script moves the `.blog-rss` link beside the heading and adds `.is-draft` only for "true" → red pill + faded row in preview (`styles.scss`); one folder per post with its images; `blog/posts/_metadata.yml` enables Quarto's built-in lightbox; `blog/_template/index.qmd` is the `new-post` template (not rendered)
  - `about.qmd` — trestles template; `subtitle:` = location under name (small grey, `styles.scss`); `about.links` commented out (social/email live in navbar); intro text + `images/sheep-gang.webp`; "Tools of the trade" X100VI pixel-art block (`.about-tools` in `styles.scss`, 6x source shown at 318px)
- **Hide vs remove**: hide via `_data/overrides.yaml` + `rebuild` (photos/projects) or `draft: true` (posts); remove via `photos.py remove` / `remove-project` or deleting a post folder. `photos.py reset` wipes all gallery webps, catalog, overrides (to template), manifest and project pages (`--keep-pages` → drafts; a re-used project name republishes on ingest); blog posts untouched.
- `styles.scss` — theme overrides on cosmo (must keep `/*-- scss:defaults --*/`, `/*-- scss:rules --*/`). Cosmo styles title-block dates with a high-specificity `#title-block-header.quarto-title-block.default …` selector — class-only overrides lose to it. `$primary` is #1a66d9 (5.3:1 on white, WCAG AA); title-block dates/categories use `$gray-600` with the theme's opacity fade removed. Fonts: Inter (`$web-font-path`). Navbar: white (`$navbar-bg`), grey lowercase menu left, bold name absolutely centred at ≥992px, social + search right, active item `$primary`; gallery chips/tags neutral greys. `html { overflow-y: scroll }` keeps the name in the same place on short and long pages. Dates: no Modified anywhere; Published shown only on blog posts (project pages keep `date:` for listing sort, hidden via `body:has(.pg-project)`).
- `_includes/` — build-time tooling, not published, wired globally in `_quarto.yml`:
  - `canonical.lua` — adds `<link rel="canonical">` (garrysykes.com, `.html` form, but `index.html` pages use the folder URL `/`, `/blog/`, `/blog/posts/<slug>/`; `scripts/sitemap.ts` post-render rewrites sitemap.xml to match)
  - `skip-link.html` — "Skip to content" link (include-before-body; repeated in `projects/_metadata.yml`)
  - `reorder-title-meta.html` — moves the Published date beneath the title on tagged pages (blog posts)
  - `external-links.html` — external links open in a new tab; blocks right-click/drag on images and open-in-new-tab on blog lightbox links (download deterrent)
  - `head.html` — GoatCounter analytics (cookie-free, no banner; code `garrysykes`) + Google Fonts preconnect + `images/apple-touch-icon.png` + site-wide RSS autodiscovery link (`/blog/index.xml`); favicon is `images/favicon.ico`; avatar sources in gitignored `images/avatar/`
  - `email-link.html` — navbar envelope `#email` (Quarto rewrites to `../#email`, so match `href$="#email"`): address stored reversed+base64, assembled into `mailto:` + subject on click (never in page source)
  - `a11y.html` — patches Quarto-generated markup for accessibility (search labels, navbar toggler role, listing links/images/heading levels); also marks the section's nav item active on sub-pages (blog posts, project pages), which Quarto doesn't
- **Search index**: `scripts/search-index.ts` (`post-render`, Quarto's Deno) tidies `search.json`: strips skip-link "Skip to content" + listing "No matching items", gives text-less pages (JS galleries) their `description:`, drops entries for deleted pages. Drafts aren't indexed (Quarto).
- **SEO**: home has a visually-hidden h1 + Person/WebSite JSON-LD in `index.qmd`; page `description:` = meta description (placeholders marked `# TODO: rewrite`); default share image `images/share.jpg` (1200x630 JPEG, copyright-stamped; `website.image` must be root-absolute `/images/...` or sub-folder pages resolve it relatively) for pages without their own `image:`. a11y styles (focus ring, reduced motion, skip link) at top of `styles.scss` rules
- Navbar: "Garry Sykes" title is the home link; Gallery (home), Projects, Blog, About; Instagram/Facebook/Email icons (GitHub commented out); search
- `_quarto.yml` `render` list globs `.qmd` per section so `.md` files (CLAUDE.md, README.md) aren't rendered; `research/` is excluded and gitignored
- Dependencies managed with `uv` — `pyproject.toml` / `uv.lock`

## Workflow

- New photos: export → `photos.py ingest` → fill new projects' `description:` → commit + push
- New post: `photos.py new-post` → `post-images` → write (preview with `--profile drafts`; plain preview/render writes drafts as blank placeholders, which also leaves their listing entry without image/summary) → remove `draft: true` → commit + push
