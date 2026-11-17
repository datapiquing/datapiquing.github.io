-- Adds <link rel="canonical"> (+ og:url, og:type) to every page so search engines index only the
-- garrysykes.com URL (not datapiquing.github.io). scripts/sitemap.ts rewrites
-- sitemap.xml index.html entries to match.

function Meta(meta)
  local site = "https://garrysykes.com/"
  local input = quarto.doc.input_file
  local root = quarto.project.directory
  if input == nil or root == nil then return meta end
  local rel = input:sub(#root + 2) -- strip "<root>/"
  rel = rel:gsub("%.qmd$", ".html") -- same form as sitemap.xml and nav links
  rel = rel:gsub("index%.html$", "") -- section/home pages: canonical is the folder URL ("/", "/blog/")
  local url = site .. rel
  -- Open Graph url/type (Quarto emits title/description/image but not these).
  local type = rel:match("^blog/posts/") and "article" or "website"
  quarto.doc.include_text("in-header",
    '<link rel="canonical" href="' .. url .. '">\n' ..
    '<meta property="og:url" content="' .. url .. '">\n' ..
    '<meta property="og:type" content="' .. type .. '">')
  return meta
end
