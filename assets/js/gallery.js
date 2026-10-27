// Photo gallery: justified thumbnail grid, genre filter, sort, infinite scroll
// and a PhotoSwipe lightbox, all driven by data/photos.json (built by
// scripts/photos.py). Paths resolve from this file, so pages at any depth work.

import PhotoSwipeLightbox from "../vendor/photoswipe/photoswipe-lightbox.esm.min.js";

const ROOT = new URL("../../", import.meta.url);
const url = (path) => new URL(path, ROOT).href;

const BATCH = 30;
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

function thumb(p, index) {
  const a = document.createElement("a");
  a.className = "pg-item";
  a.href = url(`photos/full/${p.id}.webp`);
  a.style.setProperty("--r", (p.w / p.h).toFixed(4));
  a.dataset.index = index;
  a.innerHTML = `<i style="padding-bottom:${((p.h / p.w) * 100).toFixed(3)}%"></i>` +
    `<img src="${url(`photos/thumb/${p.id}.webp`)}" alt="${esc(p.alt)}" loading="lazy">`;
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
      msrc: url(`photos/thumb/${p.id}.webp`),
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

    const q = new URLSearchParams();
    if (state.genres.size) q.set("genre", [...state.genres].join(","));
    if (state.sort !== "newest") q.set("sort", state.sort);
    const query = q.toString().replaceAll("%2C", ",");
    history.replaceState(null, "", (query ? `?${query}` : location.pathname) + location.hash);

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
  const id = new URLSearchParams(location.hash.slice(1)).get("photo");
  if (id && !grid.open(id) && state.genres.size) {
    state.genres.clear();
    apply();
    grid.open(id);
  }
}

// --- Boot -------------------------------------------------------------------

async function boot() {
  const home = document.getElementById("pg-home");
  if (!home) return;
  const manifest = await loadManifest();
  initHome(home, manifest, createLightbox());
}

boot();
