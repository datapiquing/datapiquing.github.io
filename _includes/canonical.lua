-- Adds <link rel="canonical"> to every page so search engines index only the
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
  quarto.doc.include_text("in-header", '<link rel="canonical" href="' .. site .. rel .. '">')
  return meta
end
