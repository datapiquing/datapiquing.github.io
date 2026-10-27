# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Quarto website deployed to GitHub Pages via GitHub Actions: **photography portfolio + blog** of Garry Sykes. Home is a photo gallery, Projects are metadata-driven photo galleries, Blog is dated posts, plus About. Custom domain: datapiquing.com (a new domain is planned — swap `CNAME` + `site-url`).

## Commands

```bash
uv sync                                   # setup (also needs exiftool + cwebp via Homebrew)
uv run quarto preview                     # live preview
uv run quarto render                      # build site

uv run scripts/photos.py ingest           # LrC exports -> webp + manifest + project pages
uv run scripts/photos.py rebuild          # after editing _data/overrides.yaml
uv run scripts/photos.py check            # metadata/file issues
uv run scripts/photos.py remove <id>      # / remove-project <slug> [--keep-images]
uv run scripts/photos.py new-post "<title>"
uv run scripts/photos.py post-images <post-folder>
```

## Architecture

- **Deployed via GitHub Actions** — on push to `main`, the Quarto Publish workflow (Quarto 1.5.56) renders and pushes to `gh-pages`. Checkout uses `fetch-depth: 0` so the git-date filter works. No page executes Python, so CI renders everything; `freeze: auto` stays for any future executing page (render locally, commit `_freeze/`).
- **Photo pipeline** (`scripts/photos.py`, stdlib + PyYAML, shells out to exiftool and cwebp):
  - Source: `~/Desktop/Lrc_JPEGs/lightbox/*.jpg` (1600px LrC exports). Thumbnails are derived (600px high); LrC `thumbnail/` exports are ignored but moved with sources to `Lrc_JPEGs/completed/<date>/`.
  - Photo id = `YYYYMMDD-HHMMSS-<filename stem>` from DateTimeOriginal → re-exports upsert; ids name `photos/full|thumb/<id>.webp`.
  - `_data/catalog.json` (script-owned, every photo) + `_data/overrides.yaml` (hand-edited: `hidden`, `hidden_projects`, per-id field overrides) → `data/photos.json` (published manifest: `photos`, `projects`). `_data/` is not published.
  - Metadata mapping: Title = project, Caption/Description = caption, AltTextAccessibility = alt (falls back to caption), Keywords with `_` prefix = genres, other keywords = tag cloud, Label `Red` = project cover.
  - **Privacy**: GPS never written to the manifest; webps carry no metadata. Location shown is City/Country only.
  - Project pages `projects/<slug>.qmd` are created if missing; the script only rewrites their `image:`, `date:` and `draft:` front-matter lines — title, description and prose are the user's.
- **Gallery** (`assets/js/gallery.js`, ES module): fetches `data/photos.json` (paths resolved from the module URL so any page depth works). `#pg-home` → genre chips (OR) + sort + justified grid + infinite scroll; `.pg-project[data-project]` → keyword tag cloud (AND) + grid. Lightbox is PhotoSwipe 5 vendored in `assets/vendor/photoswipe/`. Filter state in query string; `#photo=<id>` deep links. Justified rows are pure CSS (`--r` aspect ratio per item) in `styles.scss`.
- **Sections**:
  - `index.qmd` — Home gallery (title block hidden via CSS)
  - `projects/index.qmd` — Quarto grid listing of `projects/*.qmd`; `projects/_metadata.yml` injects gallery script/CSS (and repeats the site-wide `include-after-body`, since directory-level lists replace it)
  - `blog/index.qmd` — listing of `blog/posts/*/index.qmd` + RSS; one folder per post with its images; `blog/posts/_metadata.yml` enables Quarto's built-in lightbox; `blog/_template/index.qmd` is the `new-post` template (not rendered)
  - `about.qmd` — trestles template
- **Hide vs remove**: hide via `_data/overrides.yaml` + `rebuild` (photos/projects) or `draft: true` (posts); remove via `photos.py remove` / `remove-project` or deleting a post folder.
- `styles.scss` — theme overrides on cosmo (must keep `/*-- scss:defaults --*/`, `/*-- scss:rules --*/`). Cosmo styles title-block dates with a high-specificity `#title-block-header.quarto-title-block.default …` selector — class-only overrides lose to it. Theme/style redesign is deferred: don't restyle beyond what features need.
- `_includes/` — build-time tooling, not published, wired globally in `_quarto.yml`:
  - `git-modified.lua` — sets each page's `Modified` date from `git log`; uncommitted files fall back to mtime; only refreshes on the live site after commit+push
  - `reorder-title-meta.html` — moves Published/Modified dates beneath the title on tagged pages (blog posts)
- Navbar: wordmark "Garry Sykes" is the home link; Projects, Blog, About; GitHub/Instagram/Facebook icons; search
- `_quarto.yml` `render` list globs `.qmd` per section so `.md` files (CLAUDE.md, README.md) aren't rendered; `research/` is excluded and gitignored
- Dependencies managed with `uv` — `pyproject.toml` / `uv.lock`

## Workflow

- New photos: export → `photos.py ingest` → fill new projects' `description:` → commit + push
- New post: `photos.py new-post` → `post-images` → write → remove `draft: true` → commit + push
