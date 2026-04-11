# datapiquing.com

Quarto-based personal website deployed to GitHub Pages via GitHub Actions.

## Setup

```bash
uv sync
```

## Local preview

```bash
uv run quarto preview
```

## Creating a blog post

1. Create a new `.qmd` file in `blog/`:

```yaml
---
title: "Post Title"
description: "Brief description for listing page and SEO"
author: "Garry Sykes"
date: 2026-04-11
categories: [category1, category2]
---

Your content here...
```

2. The post will automatically appear in the blog listing page.

## Creating a report

1. Create a new `.qmd` file in `reports/`:

```yaml
---
title: "Report Title"
date: 2026-04-11
categories: [analysis]
format: html
execute:
  echo: false
---

Your content here...
```

## Deploying a post (no local DB queries)

If the post only uses inline data or static content:

```bash
git add blog/my-post.qmd
git commit -m "Add new post"
git push
```

GitHub Actions renders and deploys automatically.

## Deploying a post (with local DB queries)

If the post queries a local database or other local resource, the GitHub Actions runner can't execute it. You must render locally first so Quarto saves the execution output to `_freeze/`:

```bash
# 1. Render locally
uv run quarto render blog/my-db-post.qmd

# 2. Commit the source AND the frozen output
git add blog/my-db-post.qmd _freeze/blog/my-db-post/
git commit -m "Add new post with local data"
git push
```

GitHub Actions uses the frozen output from `_freeze/` and skips re-execution.

## How freeze works

`_quarto.yml` has `freeze: auto` which means:
- On `quarto render`, Quarto saves execution output to `_freeze/`
- If source hasn't changed, subsequent renders reuse frozen output
- The `_freeze/` directory is committed to git
- The GitHub Actions runner uses frozen output — it does not execute Python

## Useful links

1. [Quarto: Creating a Website](https://quarto.org/docs/websites/)
2. [HTML Theming](https://quarto.org/docs/output-formats/html-themes.html)
3. [Publish to GitHub Pages](https://quarto.org/docs/publishing/github-pages.html)
4. [Quarto Crash Course: YouTube](https://www.youtube.com/watch?v=_VKxTPWDhA4)
5. [Quarto Crash Course: GitHub](https://github.com/keithgalli/quarto-crash-course)
