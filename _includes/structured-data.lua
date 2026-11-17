-- Adds schema.org JSON-LD (structured data) to blog posts (BlogPosting) and
-- project pages (ImageGallery), so search engines know the author, date and
-- image. Home has its own WebSite/Person JSON-LD in index.qmd; the author here
-- refers to that Person by @id.

local SITE = "https://garrysykes.com/"

local person = {
  ["@type"] = "Person",
  ["@id"] = SITE .. "#person",
  name = "Garry Sykes",
  url = SITE .. "about.html",
}

local function exists(path)
  local f = io.open(path, "rb")
  if f then f:close() return true end
  return false
end

-- ISO date from the source front matter (Quarto's meta.date is already formatted).
local function iso_date(path)
  local f = io.open(path, "r")
  if not f then return nil end
  local text = f:read("a")
  f:close()
  return text:match("\ndate:%s*['\"]?(%d%d%d%d%-%d%d%-%d%d)")
end

local function str(v)
  if v == nil then return nil end
  local s = pandoc.utils.stringify(v)
  return s ~= "" and s or nil
end

function Meta(meta)
  local input = quarto.doc.input_file
  local root = quarto.project.directory
  if input == nil or root == nil or not quarto.doc.is_format("html") then return meta end
  local rel = input:sub(#root + 2)
  local dir = input:match("^(.*)/[^/]+$")
  local data

  local slug = rel:match("^blog/posts/([^/]+)/index%.qmd$")
  if slug then
    local url = SITE .. "blog/posts/" .. slug .. "/"
    local image = exists(dir .. "/share.jpg") and (url .. "share.jpg")
      or (str(meta.image) and (url .. str(meta.image)))
    data = {
      ["@type"] = "BlogPosting",
      headline = str(meta.title),
      description = str(meta.description),
      datePublished = iso_date(input),
      image = image,
      url = url,
      mainEntityOfPage = url,
      keywords = meta.categories and #meta.categories > 0 and table.concat(
        pandoc.List(meta.categories):map(pandoc.utils.stringify), ", ") or nil,
      author = person,
      publisher = person,
      inLanguage = "en",
    }
  end

  local project = rel:match("^projects/([^/]+)%.qmd$")
  if project and project ~= "index" then
    local url = SITE .. "projects/" .. project .. ".html"
    local cover = (str(meta.image) or ""):match("photos/thumb/([^/]+)%.webp$")
    local image = cover and exists(root .. "/photos/share/" .. cover .. ".jpg")
      and (SITE .. "photos/share/" .. cover .. ".jpg") or nil
    data = {
      ["@type"] = "ImageGallery",
      name = str(meta.title),
      description = str(meta.description),
      image = image,
      url = url,
      author = person,
      copyrightHolder = person,
      inLanguage = "en",
    }
  end

  if data then
    data["@context"] = "https://schema.org"
    -- "</" can't appear inside a <script> block.
    local json = pandoc.json.encode(data):gsub("</", "<\\/")
    quarto.doc.include_text("in-header", '<script type="application/ld+json">' .. json .. "</script>")
  end
  return meta
end
