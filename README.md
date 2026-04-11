# My Quarto Site


## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```



### Sassy CSS (.scss)
SCSS (Sassy CSS) is a superset of CSS — valid CSS is valid SCSS, but it adds features like:

  - Variables: $primary: #2b7cff;
  - Nesting: nest selectors inside each other
  - Mixins: reusable style blocks
  - Partials/imports: split styles across files
  - Functions & math: compute values

  It compiles down to plain CSS. Quarto uses it for theme customization, which is why styles.scss needs those layer
  boundaries (/*-- scss:defaults --*/, /*-- scss:rules --*/) — Quarto injects your SCSS into the right place in its
  Bootstrap build.

### Useful links

1. [Quarto: Creating a Website](https://quarto.org/docs/websites/)
2. [HTML Theming](https://quarto.org/docs/output-formats/html-themes.html)
3. [Publish to GitHub Pages](https://quarto.org/docs/publishing/github-pages.html)
4. [Quarto Crash Course: YouTube](https://www.youtube.com/watch?v=_VKxTPWDhA4)
5. [Quarto Crash Course: GitHub](https://github.com/keithgalli/quarto-crash-course)


### Interactive visualisations with Plotly
❯ If a .qmd file containing python code using plotly is rendered and pushed to GitHub Pages, will the plot be interactive?

⏺ Yes. Plotly outputs self-contained HTML/JS widgets, so the interactivity is preserved in the rendered HTML — no server
  needed. GitHub Pages serves static files, which is all Plotly requires.