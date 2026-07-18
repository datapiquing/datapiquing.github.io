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

### NOTE

If the global config file '**_quarto.yml**' is changed, the site will need re-rendering before the changes take effect and can be previewed

```bash
uv run quarto render
```



## Structure

The site is organised into **sections**, not a single blog. Journals *are* the blog.

```text
index.qmd            # home
now.qmd              # /now page — current focus
about.qmd            # about (trestles template)
journey/             # curated, hand-written timeline (one page per year)
projects/            # global auto-listing of every project across all hobbies
reviews/             # periodic look-backs
hobbies/<hobby>/     # a dashboard (index.qmd) plus projects/ and journal/ subfolders
  ├── goals.qmd roadmap.qmd skills.qmd tools.qmd resources.qmd
  ├── projects/      # one .qmd per project
  └── journal/       # dated journal entries
images/              # published images
assets/              # published static assets (fonts, downloads, …)
_includes/           # build-time tooling (NOT published) — see Customisations
styles.scss          # theme overrides on top of cosmo
```

**Single source of truth**: a project or journal entry lives *only* under its hobby
(`hobbies/<hobby>/projects/…` or `hobbies/<hobby>/journal/…`). Quarto *listings*
aggregate them elsewhere (e.g. `projects/index.qmd` gathers every hobby's projects). Never
maintain a list by hand.

The **Journey** section is the exception — it's curated by hand (one page per year),
not an auto-listing.

## Adding a journal entry

Create a `.qmd` under the relevant hobby's `journal/` folder:

```yaml
---
title: "Entry title"
date: 2026-04-11
categories: [category1, category2]
---

Your content here...
```

It appears automatically on that hobby's dashboard.

## Adding a project

Create a `.qmd` under the relevant hobby's `projects/` folder:

```yaml
---
title: "Project title"
description: "Brief description for listing and SEO"
date: 2026-04-11
categories: [category1, category2]
---

Your content here...
```

It appears automatically on both the hobby dashboard and the global `projects/` page. For
a project that executes Python, add `execute: echo: false` to hide the code (see
`hobbies/woodworking/projects/coffee-table.qmd`).

## Deploying (no local execution)

If the page uses only inline data or static content:

```bash
git add hobbies/woodworking/journal/my-entry.qmd
git commit -m "Add journal entry"
git push
```

GitHub Actions renders and deploys automatically.

## Deploying (with local execution / DB queries)

If the page executes Python or queries a local resource, the GitHub Actions runner can't
execute it. Render locally first so Quarto saves the output to `_freeze/`:

```bash
# 1. Render locally
uv run quarto render hobbies/woodworking/projects/my-project.qmd

# 2. Commit the source AND the frozen output
git add hobbies/woodworking/projects/my-project.qmd \
        _freeze/hobbies/woodworking/projects/my-project/
git commit -m "Add project with local data"
git push
```

GitHub Actions uses the frozen output from `_freeze/` and skips re-execution.

## How freeze works

`_quarto.yml` has `freeze: auto` which means:
- On `quarto render`, Quarto saves execution output to `_freeze/`
- If source hasn't changed, subsequent renders reuse frozen output
- The `_freeze/` directory is committed to git
- The GitHub Actions runner uses frozen output — it does not execute Python

## Customisations

Beyond `styles.scss` (theme overrides), two build-time helpers live in `_includes/`
(the `_` prefix means Quarto neither renders nor publishes them). Both are wired up
globally in `_quarto.yml`:

- **`_includes/git-modified.lua`** — a Pandoc filter that sets each page's `Modified`
  date from `git log` (the last commit that touched the file). Quarto's built-in
  `date: last-modified` uses the file's mtime, which on the CI runner is the checkout
  time (identical for every page), so the filter sources it from git instead.
  **Requires `fetch-depth: 0`** on the checkout step in `.github/workflows/publish.yml`
  so full history is available. Uncommitted files fall back to mtime.
- **`_includes/reorder-title-meta.html`** — a small script (`include-after-body`) that
  moves the Published/Modified dates to sit directly beneath the title on pages that have
  category tags (projects, journal entries, reviews).

The date shown in each page's title block is the **git commit date**, so it only updates
on the live site once a change is committed and pushed.

## Useful links

1. [Quarto: Creating a Website](https://quarto.org/docs/websites/)
2. [HTML Theming](https://quarto.org/docs/output-formats/html-themes.html)
3. [Publish to GitHub Pages](https://quarto.org/docs/publishing/github-pages.html)
4. [Quarto Crash Course: YouTube](https://www.youtube.com/watch?v=_VKxTPWDhA4)
5. [Quarto Crash Course: GitHub](https://github.com/keithgalli/quarto-crash-course)
