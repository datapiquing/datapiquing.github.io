"""Photo pipeline for the portfolio site.

Ingests Lightroom Classic JPEG exports into the repo as webp, keeps a metadata
catalogue, and builds the published manifest the gallery pages read.

    uv run scripts/photos.py ingest [--src DIR] [--dry-run] [--no-move]
    uv run scripts/photos.py rebuild
    uv run scripts/photos.py check
    uv run scripts/photos.py remove <id>...
    uv run scripts/photos.py remove-project <slug> [--keep-images]
    uv run scripts/photos.py new-post "<title>" [--date YYYY-MM-DD]
    uv run scripts/photos.py post-images <post-folder> [--src DIR] [--no-move]

Files:
    _data/catalog.json    every ingested photo (script-owned, not published)
    _data/overrides.yaml  hand-edited: hidden ids/projects, per-photo field fixes
    data/photos.json      published manifest (catalog + overrides, hidden removed)
    photos/full|thumb/    webp images, named by photo id
    projects/<slug>.qmd   one page per project; image/date/draft lines are managed
"""

import argparse
import datetime as dt
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

# --- Config -----------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent
SRC = Path.home() / "Desktop" / "Lrc_JPEGs"
SRC_SUBDIR = "lightbox"  # gallery JPEGs; falls back to SRC itself if absent
SRC_THUMB_SUBDIR = "thumbnail"  # LrC thumbnails, unused but moved with sources
BLOG_SRC = SRC / "blog"
COMPLETED = "completed"

FULL_DIR = ROOT / "photos" / "full"
THUMB_DIR = ROOT / "photos" / "thumb"
CATALOG = ROOT / "_data" / "catalog.json"
OVERRIDES = ROOT / "_data" / "overrides.yaml"
MANIFEST = ROOT / "data" / "photos.json"
PROJECTS_DIR = ROOT / "projects"
POSTS_DIR = ROOT / "blog" / "posts"
POST_TEMPLATE = ROOT / "blog" / "_template" / "index.qmd"

FULL_LONG_EDGE = 1600
FULL_QUALITY = 82
THUMB_HEIGHT = 600  # justified rows are height-constrained
THUMB_QUALITY = 75
POST_LONG_EDGE = 1600
POST_QUALITY = 82

COVER_LABEL = "Red"
GENRE_PREFIX = "_"

EXIF_TAGS = [
    "Title", "ObjectName",
    "Description", "ImageDescription", "Caption-Abstract",
    "Label", "LabelColor",
    "Keywords", "Subject", "WeightedFlatSubject",
    "AltTextAccessibility", "ExtDescrAccessibility",
    "FNumber#", "ExposureTime", "ISO", "FocalLength#",
    "ImageWidth", "ImageHeight", "DateTimeOriginal",
    "Make", "Model", "LensModel", "City", "Country",
]

OVERRIDES_TEMPLATE = """\
# Hand-edited; never overwritten by photos.py. Run `photos.py rebuild` after editing.
#
# hidden:           photo ids to hide (webps stay in repo; use `remove` to delete)
# hidden_projects:  project slugs to hide (page becomes draft; images stay on Home)
# photos:           per-id field overrides, e.g.
#   20260905-122917-DSCF0741:
#     caption: "Corrected caption"
hidden: []
hidden_projects: []
photos: {}
"""


# --- Helpers ----------------------------------------------------------------

def first(rec, *keys):
    for k in keys:
        v = rec.get(k)
        if v not in (None, "", []):
            return v
    return None


def as_list(v):
    if v is None:
        return []
    return [str(x) for x in (v if isinstance(v, list) else [v])]


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def load_json(path, default):
    return json.loads(path.read_text()) if path.exists() else default


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False, sort_keys=True) + "\n")


def load_overrides():
    if not OVERRIDES.exists():
        OVERRIDES.parent.mkdir(parents=True, exist_ok=True)
        OVERRIDES.write_text(OVERRIDES_TEMPLATE)
    data = yaml.safe_load(OVERRIDES.read_text()) or {}
    return {
        "hidden": set(data.get("hidden") or []),
        "hidden_projects": set(data.get("hidden_projects") or []),
        "photos": data.get("photos") or {},
    }


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"Command failed: {' '.join(map(str, cmd))}\n{r.stderr}")
    return r.stdout


def exiftool(paths):
    out = run(["exiftool", "-j", "-q", *[f"-{t}" for t in EXIF_TAGS], *map(str, paths)])
    return json.loads(out) if out.strip() else []


def fit(w, h, long_edge=None, height=None):
    """Target size after downscaling (never upscales)."""
    if long_edge and max(w, h) > long_edge:
        s = long_edge / max(w, h)
    elif height and h > height:
        s = height / h
    else:
        return w, h
    return round(w * s), round(h * s)


def to_webp(src, dest, w, h, size, quality):
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["cwebp", "-quiet", "-q", str(quality), "-metadata", "none"]
    if size != (w, h):
        cmd += ["-resize", str(size[0]), str(size[1])]
    run(cmd + [str(src), "-o", str(dest)])


def move_to_completed(src_root, files):
    dest_root = src_root / COMPLETED / dt.date.today().isoformat()
    for f in files:
        dest = dest_root / f.relative_to(src_root)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(f), dest)
    return dest_root


def jpegs(folder):
    return sorted(p for p in folder.glob("*") if p.suffix.lower() in (".jpg", ".jpeg"))


# --- Metadata ---------------------------------------------------------------

def to_record(meta, src):
    taken = first(meta, "DateTimeOriginal")
    if not taken:
        return None
    taken_dt = dt.datetime.strptime(str(taken)[:19], "%Y:%m:%d %H:%M:%S")
    photo_id = f"{taken_dt:%Y%m%d-%H%M%S}-{src.stem}"
    keywords = as_list(first(meta, "Keywords", "Subject", "WeightedFlatSubject"))
    project = first(meta, "Title", "ObjectName")
    caption = first(meta, "Description", "ImageDescription", "Caption-Abstract")
    w, h = fit(meta["ImageWidth"], meta["ImageHeight"], long_edge=FULL_LONG_EDGE)
    return {
        "id": photo_id,
        "file": src.name,
        "w": w,
        "h": h,
        "project": project,
        "slug": slugify(project) if project else None,
        "caption": caption,
        "alt": first(meta, "AltTextAccessibility") or caption or project,
        "ext_desc": first(meta, "ExtDescrAccessibility"),
        "keywords": [k for k in keywords if not k.startswith(GENRE_PREFIX)],
        "genres": [k[len(GENRE_PREFIX):] for k in keywords if k.startswith(GENRE_PREFIX)],
        "label": first(meta, "Label", "LabelColor"),
        "taken": taken_dt.isoformat(),
        "make": first(meta, "Make"),
        "model": first(meta, "Model"),
        "lens": first(meta, "LensModel"),
        "f": first(meta, "FNumber"),
        "shutter": str(first(meta, "ExposureTime")) if first(meta, "ExposureTime") else None,
        "iso": first(meta, "ISO"),
        "focal": first(meta, "FocalLength"),
        "city": first(meta, "City"),
        "country": first(meta, "Country"),
    }


# --- Build ------------------------------------------------------------------

def build_projects(photos):
    """Group published photos by project and pick each cover."""
    groups = {}
    for p in photos:
        if p.get("slug"):
            groups.setdefault(p["slug"], []).append(p)
    projects = []
    for slug, items in groups.items():
        items.sort(key=lambda p: p["taken"], reverse=True)
        reds = [p for p in items if p.get("label") == COVER_LABEL]
        cover = reds[0] if reds else items[0]
        projects.append({
            "slug": slug,
            "title": items[0]["project"],
            "cover": cover["id"],
            "count": len(items),
            "latest": items[0]["taken"],
            "covers_labelled": len(reds),
        })
    projects.sort(key=lambda p: p["latest"], reverse=True)
    return projects


def set_front_matter(text, key, value):
    """Set (or with value None, delete) a top-level key in a qmd's front matter."""
    head, sep, body = text.partition("\n---\n")
    lines = [l for l in head.split("\n") if not l.startswith(f"{key}:")]
    if value is not None:
        lines.append(f"{key}: {value}")
    return "\n".join(lines) + sep + body


def sync_project_pages(projects, catalog, hidden_projects):
    """Create missing project pages; update their managed image/date/draft lines."""
    by_slug = {p["slug"]: p for p in projects}
    # Hidden projects have no published photos, so derive them from the catalog.
    for slug in hidden_projects:
        if slug not in by_slug:
            items = [p for p in catalog.values() if p.get("slug") == slug]
            if items:
                by_slug[slug] = build_projects(items)[0]
    created = []
    for slug, proj in by_slug.items():
        page = PROJECTS_DIR / f"{slug}.qmd"
        if not page.exists():
            title = proj["title"].replace('"', '\\"')
            page.parent.mkdir(parents=True, exist_ok=True)
            page.write_text(
                f'---\ntitle: "{title}"\ndescription: ""\n---\n\n'
                f'::: {{.pg-project data-project="{slug}"}}\n:::\n'
            )
            created.append(slug)
        text = page.read_text()
        text = set_front_matter(text, "image", f"../photos/thumb/{proj['cover']}.webp")
        text = set_front_matter(text, "date", proj["latest"][:10])
        text = set_front_matter(text, "draft", "true" if slug in hidden_projects else None)
        page.write_text(text)
    return created


def rebuild(quiet=False):
    catalog = load_json(CATALOG, {})
    ov = load_overrides()
    photos = []
    for pid, rec in catalog.items():
        if pid in ov["hidden"]:
            continue
        rec = {**rec, **ov["photos"].get(pid, {})}
        if not rec.get("alt"):  # no alt text, caption or title: describe by keywords
            rec["alt"] = "Photograph: " + ", ".join(rec["genres"] + rec["keywords"]) if (rec["genres"] or rec["keywords"]) else "Photograph"
        if rec.get("slug") in ov["hidden_projects"]:
            rec["project"] = rec["slug"] = None
        photos.append(rec)
    photos.sort(key=lambda p: p["taken"], reverse=True)
    projects = build_projects(photos)
    write_json(MANIFEST, {"photos": photos, "projects": projects})
    created = sync_project_pages(projects, catalog, ov["hidden_projects"])
    if not quiet:
        print(f"Manifest: {len(photos)} photos, {len(projects)} projects -> {MANIFEST.relative_to(ROOT)}")
        for slug in created:
            print(f"  new project page: projects/{slug}.qmd (add a description)")


# --- Commands ---------------------------------------------------------------

def cmd_ingest(args):
    src = Path(args.src).expanduser()
    folder = src / SRC_SUBDIR if (src / SRC_SUBDIR).is_dir() else src
    files = jpegs(folder)
    if not files:
        print(f"No JPEGs in {folder}")
        return
    catalog = load_json(CATALOG, {})
    done, skipped = [], []
    for meta in exiftool(files):
        f = Path(meta["SourceFile"])
        rec = to_record(meta, f)
        if not rec:
            skipped.append(f.name)
            continue
        verb = "update" if rec["id"] in catalog else "add"
        print(f"  {verb:6} {rec['id']}  {rec['project'] or '-'}")
        if args.dry_run:
            continue
        rec["added"] = catalog.get(rec["id"], {}).get("added") or dt.date.today().isoformat()
        to_webp(f, FULL_DIR / f"{rec['id']}.webp", meta["ImageWidth"], meta["ImageHeight"],
                (rec["w"], rec["h"]), FULL_QUALITY)
        to_webp(f, THUMB_DIR / f"{rec['id']}.webp", meta["ImageWidth"], meta["ImageHeight"],
                fit(meta["ImageWidth"], meta["ImageHeight"], height=THUMB_HEIGHT), THUMB_QUALITY)
        catalog[rec["id"]] = rec
        done.append(f)
    for name in skipped:
        print(f"  skip   {name} (no DateTimeOriginal)")
    if args.dry_run:
        print("Dry run: nothing written.")
        return
    write_json(CATALOG, catalog)
    rebuild()
    if not args.no_move and done:
        thumbs = [t for f in done if (t := src / SRC_THUMB_SUBDIR / f.name).exists()]
        dest = move_to_completed(src, done + thumbs)
        print(f"Moved {len(done)} source(s) to {dest}")
    print()
    cmd_check(args)


def cmd_rebuild(args):
    rebuild()


def cmd_check(args):
    catalog = load_json(CATALOG, {})
    manifest = load_json(MANIFEST, {"photos": [], "projects": []})
    issues = []
    published = manifest["photos"]
    for label, test in [
        ("missing caption", lambda p: not p.get("caption")),
        ("missing alt text (caption used)", lambda p: p.get("alt") == p.get("caption") and p.get("caption")),
        ("no genre keyword", lambda p: not p.get("genres")),
        ("no project (Home only)", lambda p: not p.get("slug")),
    ]:
        ids = [p["id"] for p in published if test(p)]
        if ids:
            issues.append(f"{len(ids)} {label}: {', '.join(ids[:5])}{' ...' if len(ids) > 5 else ''}")
    for proj in manifest["projects"]:
        if proj["covers_labelled"] != 1:
            issues.append(f"project {proj['slug']}: {proj['covers_labelled']} '{COVER_LABEL}' covers (using {proj['cover']})")
    slugs = {p["slug"] for p in manifest["projects"]}
    for page in sorted(PROJECTS_DIR.glob("*.qmd")):
        if page.stem == "index":
            continue
        text = page.read_text()
        if page.stem not in slugs and "draft: true" not in text:
            issues.append(f"projects/{page.name}: no photos")
        if re.search(r'^description:\s*(""|\'\')?\s*$', text, re.M):
            issues.append(f"projects/{page.name}: empty description")
    for d in (FULL_DIR, THUMB_DIR):
        for f in sorted(d.glob("*.webp")) if d.exists() else []:
            if f.stem not in catalog:
                issues.append(f"orphan file: {f.relative_to(ROOT)}")
        for pid in catalog:
            if not (d / f"{pid}.webp").exists():
                issues.append(f"missing file: {(d / f'{pid}.webp').relative_to(ROOT)}")
    genres = {}
    for p in published:
        for g in p["genres"]:
            genres[g] = genres.get(g, 0) + 1
    print(f"Check: {len(catalog)} catalogued, {len(published)} published, {len(manifest['projects'])} projects")
    print("Genres: " + ", ".join(f"{g} ({n})" for g, n in sorted(genres.items())))
    for i in issues:
        print(f"  ! {i}")
    if not issues:
        print("  no issues")


def cmd_remove(args):
    catalog = load_json(CATALOG, {})
    for pid in args.ids:
        if catalog.pop(pid, None) is None:
            print(f"  not found: {pid}")
            continue
        for d in (FULL_DIR, THUMB_DIR):
            (d / f"{pid}.webp").unlink(missing_ok=True)
        print(f"  removed {pid}")
    write_json(CATALOG, catalog)
    rebuild()


def cmd_remove_project(args):
    catalog = load_json(CATALOG, {})
    ids = [pid for pid, p in catalog.items() if p.get("slug") == args.slug]
    page = PROJECTS_DIR / f"{args.slug}.qmd"
    if not ids and not page.exists():
        sys.exit(f"No project '{args.slug}'")
    page.unlink(missing_ok=True)
    for pid in ids:
        if args.keep_images:
            catalog[pid]["project"] = catalog[pid]["slug"] = None
        else:
            catalog.pop(pid)
            for d in (FULL_DIR, THUMB_DIR):
                (d / f"{pid}.webp").unlink(missing_ok=True)
    write_json(CATALOG, catalog)
    print(f"Removed project {args.slug} ({len(ids)} photos {'kept on Home' if args.keep_images else 'deleted'})")
    rebuild()


def cmd_new_post(args):
    date = args.date or dt.date.today().isoformat()
    folder = POSTS_DIR / f"{date}-{slugify(args.title)}"
    if folder.exists():
        sys.exit(f"Already exists: {folder.relative_to(ROOT)}")
    folder.mkdir(parents=True)
    text = POST_TEMPLATE.read_text()
    for key, value in {
        "title": args.title.replace('"', '\\"'),
        "date": date,
        "folder": folder.name,
    }.items():
        text = text.replace(f"{{{key}}}", value)
    (folder / "index.qmd").write_text(text)
    print(f"Created {(folder / 'index.qmd').relative_to(ROOT)} (draft: true; remove when ready)")


def cmd_post_images(args):
    folder = Path(args.folder)
    if not folder.is_absolute():
        folder = (POSTS_DIR / folder) if not folder.exists() else folder.resolve()
    if not (folder / "index.qmd").exists():
        sys.exit(f"Not a post folder: {folder}")
    src = Path(args.src).expanduser()
    files = jpegs(src)
    if not files:
        print(f"No JPEGs in {src}")
        return
    for meta in exiftool(files):
        f = Path(meta["SourceFile"])
        w, h = meta["ImageWidth"], meta["ImageHeight"]
        dest = folder / f"{slugify(f.stem)}.webp"
        to_webp(f, dest, w, h, fit(w, h, long_edge=POST_LONG_EDGE), POST_QUALITY)
        print(f"  {f.name} -> {dest.relative_to(ROOT)}")
    if not args.no_move:
        print(f"Moved {len(files)} source(s) to {move_to_completed(src, files)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("ingest", help="convert + catalogue new LrC exports")
    p.add_argument("--src", default=str(SRC))
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--no-move", action="store_true", help="leave sources in place")
    p.set_defaults(func=cmd_ingest)

    sub.add_parser("rebuild", help="regenerate manifest after editing overrides").set_defaults(func=cmd_rebuild)
    sub.add_parser("check", help="report metadata/file issues").set_defaults(func=cmd_check)

    p = sub.add_parser("remove", help="permanently delete photos")
    p.add_argument("ids", nargs="+")
    p.set_defaults(func=cmd_remove)

    p = sub.add_parser("remove-project", help="delete a project page (+ its photos)")
    p.add_argument("slug")
    p.add_argument("--keep-images", action="store_true", help="keep photos on Home")
    p.set_defaults(func=cmd_remove_project)

    p = sub.add_parser("new-post", help="scaffold a dated blog post folder")
    p.add_argument("title")
    p.add_argument("--date", help="YYYY-MM-DD (default today)")
    p.set_defaults(func=cmd_new_post)

    p = sub.add_parser("post-images", help="convert blog JPEGs into a post folder")
    p.add_argument("folder", help="post folder path or name under blog/posts/")
    p.add_argument("--src", default=str(BLOG_SRC))
    p.add_argument("--no-move", action="store_true")
    p.set_defaults(func=cmd_post_images)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
