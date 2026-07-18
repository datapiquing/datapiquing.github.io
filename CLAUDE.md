# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Quarto-based personal website deployed to GitHub Pages via GitHub Actions. A **sectioned personal site** (not a blog): journeys, projects, reviews and hobby dashboards, plus about/now/home pages. Content can include executable Python. Custom domain: datapiquing.com

## Commands

```bash
# Setup
uv sync

# Preview locally (live reload)
uv run quarto preview

# Build static site
uv run quarto render

# Render single file
uv run quarto render hobbies/woodworking/projects/coffee-table.qmd
```

## Architecture

- **Quarto website project** configured in `_quarto.yml`
- **Deployed via GitHub Actions** — on push to `main`, the Quarto Publish workflow renders and pushes to `gh-pages` branch. GitHub Pages serves from `gh-pages`. Checkout uses `fetch-depth: 0` (full history) so the git-date filter works — see below
- **`freeze: auto`** — Python execution output is saved to `_freeze/` and committed to git. The GitHub Actions runner uses frozen output and does not execute Python code. Pages that execute Python or query local databases must be rendered locally before pushing.
- Content is `.qmd` files (Markdown + optional executable Python code blocks)
- **Sections** (no `/blog` — journals are the blog):
  - `journey/` — curated, hand-written timeline; one page per year. The one place lists are maintained manually
  - `projects/index.qmd` — global auto-listing aggregating `hobbies/**/projects/*.qmd`
  - `reviews/` — periodic reviews, auto-listed via `reviews/index.qmd`
  - `hobbies/<hobby>/` — a dashboard (`index.qmd`) with named listings for its `projects/` and `journal/`, plus support pages (goals, roadmap, skills, tools, resources)
- **Single source of truth**: a project or journal entry lives only under its hobby; listings aggregate them elsewhere. Never duplicate a page or hand-maintain a cross-section list.
- `now.qmd` — a [/now page](https://nownownow.com); `about.qmd` — about page (trestles template, profile image from `images/`)
- `styles.scss` — custom theme overrides on top of cosmo theme (must use Quarto SCSS layer boundaries: `/*-- scss:defaults --*/`, `/*-- scss:rules --*/`). Note: cosmo styles the title-block dates via a high-specificity `#title-block-header.quarto-title-block.default …` selector — class-only overrides lose to it
- `_includes/` — build-time tooling, not rendered/published, wired globally in `_quarto.yml`:
  - `git-modified.lua` — Pandoc filter setting each page's `Modified` date from `git log` (last commit touching the file). Quarto's `date: last-modified` uses mtime = checkout time on CI, so git is the accurate source; needs `fetch-depth: 0`. Uncommitted files fall back to mtime. Title-block date only refreshes on the live site after commit+push
  - `reorder-title-meta.html` — `include-after-body` script moving Published/Modified dates directly beneath the title on tagged pages (projects, journal, reviews)
- Navbar: wordmark `datapiquing` is the home link (no separate Home item); `date-modified: last-modified` + `date-format: medium` set globally in `_quarto.yml`
- `_quarto.yml` `render` list globs `.qmd` per section, preventing `.md` files (CLAUDE.md, README.md) from being rendered
- Pages use Quarto-native features: callouts, mermaid diagrams, collapsible sections, LaTeX, listings
- Dependencies managed with `uv` — `pyproject.toml` for direct deps, `uv.lock` for reproducible installs

## Workflow

### Pages without local execution
Just commit `.qmd` files and push. GitHub Actions renders and deploys.

### Pages with Python / local DB queries
1. Render locally: `uv run quarto render hobbies/<hobby>/projects/my-project.qmd`
2. Commit both `.qmd` and the corresponding `_freeze/` changes
3. Push — GitHub Actions uses frozen output
