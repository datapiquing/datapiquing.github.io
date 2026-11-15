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
    // Respect the OS "reduce motion" setting: no zoom/fade on open/close.
    ...(matchMedia("(prefers-reduced-motion: reduce)").matches && { showHideAnimationType: "none" }),
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
    // Single-select; "" = All. Old comma-separated links keep their first genre.
    genre: (params.get("genre") || "").split(",")[0],
    sort: params.get("sort") === "oldest" ? "oldest" : "newest",
  };

  const counts = {};
  manifest.photos.forEach((p) => p.genres.forEach((g) => (counts[g] = (counts[g] || 0) + 1)));
  const genres = Object.keys(counts).sort();
  if (!counts[state.genre]) state.genre = "";

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
      const on = b.dataset.genre === state.genre;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
    select.value = state.sort;

    setQuery({
      genre: state.genre,
      sort: state.sort !== "newest" && state.sort,
    });

    const photos = manifest.photos.filter((p) => !state.genre || p.genres.includes(state.genre));
    if (state.sort === "oldest") photos.reverse(); // manifest is newest-first
    grid.set(photos);
  };

  chips.addEventListener("click", (e) => {
    const b = e.target.closest(".pg-chip");
    if (!b) return;
    state.genre = b.dataset.genre;
    apply();
  });
  select.addEventListener("change", () => {
    state.sort = select.value;
    apply();
  });

  apply();

  // Deep link: #photo=<id>. Clear filters if the photo is filtered out.
  const id = deepLinkId();
  if (id && !grid.open(id) && state.genre) {
    state.genre = "";
    apply();
    grid.open(id);
  }
}

// --- Project page: keyword tag cloud ----------------------------------------

function initProject(el, manifest, lightbox) {
  const slug = el.dataset.project;
  const all = manifest.photos.filter((p) => p.slug === slug);
  // Single-select; "" = all. Old comma-separated links keep their first tag.
  let tag = (new URLSearchParams(location.search).get("tag") || "").split(",")[0];

  const counts = {};
  all.forEach((p) => p.keywords.forEach((k) => (counts[k] = (counts[k] || 0) + 1)));
  // Drop near-universal keywords (e.g. the city on every photo): they filter nothing.
  const tags = Object.keys(counts)
    .filter((k) => all.length < 3 || counts[k] < all.length * 0.9)
    .sort((a, b) => a.localeCompare(b));
  if (!tags.includes(tag)) tag = "";

  el.innerHTML = `
    <div class="pg-tags" role="group" aria-label="Filter by keyword"></div>
    <div class="pg-grid"></div>`;
  const cloud = el.querySelector(".pg-tags");
  const grid = infiniteGrid(el.querySelector(".pg-grid"), lightbox);

  // "show:" label + "all" first (always visible), then A-Z tags with photo
  // counts, then an inline "+N more" / "less" toggle.
  cloud.innerHTML =
    `<span class="pg-tags-label" aria-hidden="true">show:</span>` +
    `<button type="button" class="pg-tag pg-tag-all" data-tag="">all</button>` +
    tags
      .map((t) =>
        `<button type="button" class="pg-tag" data-tag="${esc(t)}">${esc(t)}` +
        ` <span class="pg-tag-count">(${counts[t]})</span></button>`
      )
      .join("") +
    `<button type="button" class="pg-tags-toggle" aria-expanded="false" hidden></button>`;
  const toggle = cloud.querySelector(".pg-tags-toggle");
  const tagButtons = [...cloud.querySelectorAll(".pg-tag:not(.pg-tag-all)")];
  let expanded = false;

  // Number of wrapped rows among visible items (flex lines never overlap).
  const rows = () => {
    let n = 0, bottom = -Infinity;
    for (const c of cloud.children) {
      if (c.hidden) continue;
      const r = c.getBoundingClientRect();
      if (r.top >= bottom - 1) { n++; bottom = r.bottom; }
      else bottom = Math.max(bottom, r.bottom);
    }
    return n;
  };

  // Collapsed: hide whole tags from the tail (never the selected one) until
  // everything, including the toggle, fits in 2 rows (3 on phones).
  const phone = matchMedia("(max-width: 575.98px)");
  const layout = () => {
    const ROWS = phone.matches ? 3 : 2;
    tagButtons.forEach((b) => (b.hidden = false));
    toggle.hidden = true;
    if (rows() <= ROWS) return;
    toggle.hidden = false;
    toggle.setAttribute("aria-expanded", expanded);
    if (expanded) {
      toggle.textContent = "less";
      return;
    }
    let hidden = 0;
    toggle.textContent = "+1 more";
    for (let i = tagButtons.length - 1; i >= 0 && rows() > ROWS; i--) {
      if (tagButtons[i].dataset.tag === tag) continue;
      tagButtons[i].hidden = true;
      toggle.textContent = `+${++hidden} more`;
    }
  };

  const apply = () => {
    cloud.querySelectorAll(".pg-tag").forEach((b) => {
      const on = b.dataset.tag === tag;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
    layout();
    setQuery({ tag });
    grid.set(all.filter((p) => !tag || p.keywords.includes(tag)));
  };

  cloud.addEventListener("click", (e) => {
    if (e.target.closest(".pg-tags-toggle")) {
      expanded = !expanded;
      layout();
      return;
    }
    const b = e.target.closest(".pg-tag");
    if (!b) return;
    tag = b.dataset.tag && b.dataset.tag !== tag ? b.dataset.tag : "";
    apply();
  });
  let raf = 0;
  addEventListener("resize", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(layout);
  });
  document.fonts?.ready.then(layout); // web font changes tag widths

  apply();

  const id = deepLinkId();
  if (id && !grid.open(id) && tag) {
    tag = "";
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
