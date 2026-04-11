# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Quarto-based personal website deployed to GitHub Pages via GitHub Actions. Contains blog posts, data reports with Python code execution, an about page, and a home page. Custom domain: datapiquing.com

## Commands

```bash
# Setup
uv sync

# Preview locally (live reload)
uv run quarto preview

# Build static site
uv run quarto render

# Render single file
uv run quarto render blog/first-post.qmd
```

## Architecture

- **Quarto website project** configured in `_quarto.yml`
- **Deployed via GitHub Actions** — `docs/` is not committed; the action renders and deploys directly
- **`freeze: auto`** — Python execution output is saved to `_freeze/` and committed to git. The GitHub Actions runner uses frozen output and does not execute Python code. Posts that query local databases must be rendered locally before pushing.
- Content is `.qmd` files (Markdown + executable Python code blocks)
- `blog/` — blog posts with date/categories frontmatter, auto-listed via `blog/index.qmd`
- `reports/` — data reports with Python visualizations (`echo: false` hides code), auto-listed via `reports/index.qmd`
- `about.qmd` — about page using Quarto's `jolla` template with profile image from `images/`
- `styles.scss` — custom theme overrides on top of cosmo theme (must use Quarto SCSS layer boundaries: `/*-- scss:defaults --*/`, `/*-- scss:rules --*/`)
- `_quarto.yml` `render` list explicitly includes only `.qmd` files to prevent `.md` files (CLAUDE.md, README.md) from being rendered
- Blog posts use Quarto-native features: callouts, mermaid diagrams, collapsible sections, LaTeX
- Dependencies managed with `uv` — `pyproject.toml` for direct deps, `uv.lock` for reproducible installs

## Workflow

### Posts without local DB queries
Just commit `.qmd` files and push. GitHub Actions renders and deploys.

### Posts with local DB queries
1. Render locally: `uv run quarto render reports/my-report.qmd`
2. Commit both `.qmd` and `_freeze/` changes
3. Push — GitHub Actions uses frozen output
