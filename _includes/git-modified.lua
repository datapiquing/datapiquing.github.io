-- Sets `date-modified` from the last git commit that touched this file.
--
-- Quarto's built-in `date: last-modified` uses the file's modification time,
-- which on the GitHub Actions runner is the checkout time (identical for every
-- page). Sourcing it from `git log` instead gives a true per-page "last edited"
-- date on the live site. For files not yet committed, git returns nothing and
-- we leave whatever fallback the document already has (e.g. mtime).

function Meta(meta)
  local file = nil
  if quarto ~= nil and quarto.doc ~= nil then
    file = quarto.doc.input_file
  end
  if file == nil and PANDOC_STATE ~= nil and PANDOC_STATE.input_files ~= nil then
    file = PANDOC_STATE.input_files[1]
  end
  if file == nil then return meta end

  local handle = io.popen('git log -1 --format=%cs -- "' .. file .. '" 2>/dev/null')
  if handle == nil then return meta end
  local out = handle:read('*a') or ''
  handle:close()
  out = out:gsub('%s+$', '')

  -- Quarto does not re-format a value set by a filter, so format it here to
  -- match `date-format: medium` (e.g. "Apr 11, 2026"). Git's %cs is YYYY-MM-DD.
  local months = {"Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"}
  local y, m, d = out:match('^(%d+)-(%d+)-(%d+)$')
  if y ~= nil then
    local label = months[tonumber(m)] .. ' ' .. tonumber(d) .. ', ' .. y
    meta['date-modified'] = pandoc.MetaString(label)
  end
  return meta
end
