'use strict'

// Простая транслитерация RU→latin для стабильных URL-slug'ов (см.
// docs/superpowers/specs/2026-07-01-spravochnik-seo-pages-design.md).
const MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
}

function translitToSlug(text) {
  const lower = String(text).toLowerCase()
  let out = ''
  for (const ch of lower) {
    out += MAP[ch] !== undefined ? MAP[ch] : ch
  }
  return out
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

module.exports = { translitToSlug }
