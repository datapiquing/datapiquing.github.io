// Photo gallery: justified thumbnail grid, genre filter, sort, infinite scroll
// and a PhotoSwipe lightbox, all driven by data/photos.json (built by
// scripts/photos.py). Paths resolve from this file, so pages at any depth work.

import PhotoSwipeLightbox from "../vendor/photoswipe/photoswipe-lightbox.esm.min.js";

const ROOT = new URL("../../", import.meta.url);
const url = (path) => new URL(path, ROOT).href;

const BATCH = 30;
const EAGER = 8;
// Thumbnail heights (px) from scripts/photos.py and grid row heights from styles.scss.
const THUMB_H = { small: 300, thumb: 600 };
const ROW_H = { phone: 110, wide: 240 };
const COPYRIGHT = "© Garry Sykes";

let manifestPromise;
const loadManifest = () =>
  (manifestPromise ??= fetch(url("data/photos.json")).then((r) => r.json()));

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function exifLine(p) {
  if (!p.make?.startsWith("FUJIFILM")) return null;
  const parts = [
    p.f && `f/${+p.f}`,
    p.shutter && `${p.shutter}s`,
    p.iso && `ISO ${p.iso}`,
    p.focal && `${+p.focal}mm`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function captionHTML(p) {
  const project = p.slug
    ? `<a href="${url(`projects/${p.slug}.html`)}">${esc(p.project)}</a>`
    : null;
  const place = [p.city, p.country].filter(Boolean).join(", ");
  const meta = [project, formatDate(p.taken), exifLine(p), place && esc(place), COPYRIGHT]
    .filter(Boolean)
    .join(" · ");
  return (p.caption ? `<p class="pg-cap-text">${esc(p.caption)}</p>` : "") +
    `<p class="pg-cap-meta">${meta}</p>`;
}

// --- Lightbox ---------------------------------------------------------------

function createLightbox() {
  const lightbox = new PhotoSwipeLightbox({
    pswpModule: () => import("../vendor/photoswipe/photoswipe.esm.min.js"),
    bgOpacity: 1,
    paddingFn: (viewport) => {
      const side = viewport.x > 800 ? 70 : 0;
      return { top: 20, bottom: 110, left: side, right: side };
    },
  });

  lightbox.on("uiRegister", () => {
    lightbox.pswp.ui.registerElement({
      name: "pg-caption",
      appendTo: "root",
      onInit: (el, pswp) => {
        // "change" also fires once the first slide is ready on open.
        pswp.on("change", () => {
          const p = pswp.currSlide.data.photo;
          el.innerHTML = captionHTML(p);
          history.replaceState(null, "", `#photo=${p.id}`);
        });
      },
    });
  });

  lightbox.on("destroy", () => {
    history.replaceState(null, "", location.pathname + location.search);
  });

  lightbox.init();
  return lightbox;
}

// --- Grid -------------------------------------------------------------------

// srcset lets phones fetch the small thumbnail; high-DPI screens still get the sharp one.
function srcset(p) {
  return Object.entries(THUMB_H)
    .map(([dir, h]) => `${url(`photos/${dir}/${p.id}.webp`)} ${Math.round((p.w / p.h) * Math.min(h, p.h))}w`)
    .join(", ");
}

function thumb(p, index) {
  const r = p.w / p.h;
  const a = document.createElement("a");
  a.className = "pg-item";
  a.href = `#photo=${p.id}`; // not the image URL, so "open in new tab" can't grab the file
  a.style.setProperty("--r", r.toFixed(4));
  a.dataset.index = index;
  a.innerHTML = `<i style="padding-bottom:${((p.h / p.w) * 100).toFixed(3)}%"></i>` +
    `<img src="${url(`photos/thumb/${p.id}.webp`)}" srcset="${srcset(p)}"` +
    ` sizes="(max-width: 575.98px) ${Math.round(r * ROW_H.phone)}px, ${Math.round(r * ROW_H.wide)}px"` +
    ` alt="${esc(p.alt)}"` +
    // First rows are above the fold: load immediately for a fast first paint.
    (index < EAGER ? ` fetchpriority="${index < 3 ? "high" : "auto"}">` : ` loading="lazy">`);
  return a;
}

// Renders `photos` into `grid` in batches as the user scrolls; returns a
// function that replaces the list (used by filters/sort).
function infiniteGrid(grid, lightbox) {
  const sentinel = document.createElement("div");
  sentinel.className = "pg-sentinel";
  grid.after(sentinel);

  let list = [];
  let shown = 0;

  const nearBottom = () => sentinel.getBoundingClientRect().top < innerHeight + 800;
  const more = () => {
    while (shown < list.length) {
      const frag = document.createDocumentFragment();
      list.slice(shown, shown + BATCH).forEach((p, i) => frag.append(thumb(p, shown + i)));
      grid.append(frag);
      shown = Math.min(shown + BATCH, list.length);
      if (!nearBottom()) break;
    }
  };
  new IntersectionObserver((entries) => entries[0].isIntersecting && more(), {
    rootMargin: "800px",
  }).observe(sentinel);

  grid.addEventListener("click", (e) => {
    const a = e.target.closest(".pg-item");
    if (!a) return;
    e.preventDefault();
    openAt(+a.dataset.index);
  });

  const openAt = (index) => {
    lightbox.options.dataSource = list.map((p) => ({
      src: url(`photos/full/${p.id}.webp`),
      msrc: url(`photos/small/${p.id}.webp`),
      width: p.w,
      height: p.h,
      alt: p.alt,
      photo: p,
    }));
    lightbox.loadAndOpen(index);
  };

  return {
    set(photos) {
      list = photos;
      shown = 0;
      grid.replaceChildren();
      more();
    },
    open(id) {
      const index = list.findIndex((p) => p.id === id);
      if (index >= 0) openAt(index);
      return index >= 0;
    },
  };
}

// --- Home: genre chips + sort ----------------------------------------------

function initHome(el, manifest, lightbox) {
  const params = new URLSearchParams(location.search);
  const state = {
    genres: new Set((params.get("genre") || "").split(",").filter(Boolean)),
    sort: params.get("sort") === "oldest" ? "oldest" : "newest",
  };

  const counts = {};
  manifest.photos.forEach((p) => p.genres.forEach((g) => (counts[g] = (counts[g] || 0) + 1)));
  const genres = Object.keys(counts).sort();

  el.innerHTML = `
    <div class="pg-controls">
      <div class="pg-chips" role="group" aria-label="Filter by genre"></div>
      <label class="pg-sort">Sort
        <select class="form-select form-select-sm">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </label>
    </div>
    <div class="pg-grid"></div>`;

  const chips = el.querySelector(".pg-chips");
  const select = el.querySelector("select");
  const grid = infiniteGrid(el.querySelector(".pg-grid"), lightbox);

  const chip = (label, value) =>
    `<button type="button" class="pg-chip" data-genre="${esc(value)}">${esc(label)}</button>`;
  chips.innerHTML = chip("All", "") + genres.map((g) => chip(`${g} (${counts[g]})`, g)).join("");

  const apply = () => {
    chips.querySelectorAll(".pg-chip").forEach((b) => {
      const on = b.dataset.genre ? state.genres.has(b.dataset.genre) : state.genres.size === 0;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
    select.value = state.sort;

    setQuery({
      genre: [...state.genres].join(","),
      sort: state.sort !== "newest" && state.sort,
    });

    // OR filter: a photo matches if it has any selected genre.
    const photos = manifest.photos.filter(
      (p) => !state.genres.size || p.genres.some((g) => state.genres.has(g))
    );
    if (state.sort === "oldest") photos.reverse(); // manifest is newest-first
    grid.set(photos);
  };

  chips.addEventListener("click", (e) => {
    const b = e.target.closest(".pg-chip");
    if (!b) return;
    const g = b.dataset.genre;
    if (!g) state.genres.clear();
    else state.genres.has(g) ? state.genres.delete(g) : state.genres.add(g);
    apply();
  });
  select.addEventListener("change", () => {
    state.sort = select.value;
    apply();
  });

  apply();

  // Deep link: #photo=<id>. Clear filters if the photo is filtered out.
  const id = deepLinkId();
  if (id && !grid.open(id) && state.genres.size) {
    state.genres.clear();
    apply();
    grid.open(id);
  }
}

// --- Project page: keyword tag cloud ----------------------------------------

function initProject(el, manifest, lightbox) {
  const slug = el.dataset.project;
  const all = manifest.photos.filter((p) => p.slug === slug);
  const selected = new Set(
    (new URLSearchParams(location.search).get("tag") || "").split(",").filter(Boolean)
  );

  const counts = {};
  all.forEach((p) => p.keywords.forEach((k) => (counts[k] = (counts[k] || 0) + 1)));
  const tags = Object.keys(counts).sort();
  const max = Math.max(1, ...Object.values(counts));

  el.innerHTML = `
    <div class="pg-tags" role="group" aria-label="Filter by keyword"></div>
    <div class="pg-grid"></div>`;
  const cloud = el.querySelector(".pg-tags");
  const grid = infiniteGrid(el.querySelector(".pg-grid"), lightbox);

  // Font size scales with how many of the project's photos use the keyword.
  cloud.innerHTML = tags
    .map((t) => {
      const size = (0.8 + 0.7 * (counts[t] - 1) / Math.max(1, max - 1)).toFixed(2);
      return `<button type="button" class="pg-tag" data-tag="${esc(t)}" style="font-size:${size}rem"` +
        ` title="${counts[t]} photo${counts[t] > 1 ? "s" : ""}">${esc(t)}</button>`;
    })
    .join("") +
    `<button type="button" class="pg-tag pg-tag-clear" hidden>clear</button>`;

  const apply = () => {
    cloud.querySelectorAll(".pg-tag[data-tag]").forEach((b) => {
      const on = selected.has(b.dataset.tag);
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
    cloud.querySelector(".pg-tag-clear").hidden = !selected.size;
    setQuery({ tag: [...selected].join(",") });
    // AND filter: a photo must carry every selected keyword.
    grid.set(all.filter((p) => [...selected].every((t) => p.keywords.includes(t))));
  };

  cloud.addEventListener("click", (e) => {
    const b = e.target.closest(".pg-tag");
    if (!b) return;
    if (!b.dataset.tag) selected.clear();
    else selected.has(b.dataset.tag) ? selected.delete(b.dataset.tag) : selected.add(b.dataset.tag);
    apply();
  });

  apply();

  const id = deepLinkId();
  if (id && !grid.open(id) && selected.size) {
    selected.clear();
    apply();
    grid.open(id);
  }
}

// --- Boot -------------------------------------------------------------------

function deepLinkId() {
  return new URLSearchParams(location.hash.slice(1)).get("photo");
}

// Replace the query string (empty values dropped), keeping commas readable.
function setQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && q.set(k, v));
  const query = q.toString().replaceAll("%2C", ",");
  history.replaceState(null, "", (query ? `?${query}` : location.pathname) + location.hash);
}

async function boot() {
  const home = document.getElementById("pg-home");
  const project = document.querySelector(".pg-project[data-project]");
  if (!home && !project) return;
  const manifest = await loadManifest();
  const lightbox = createLightbox();
  if (home) initHome(home, manifest, lightbox);
  if (project) initProject(project, manifest, lightbox);
}

boot();
