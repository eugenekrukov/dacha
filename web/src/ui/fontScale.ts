// Размер шрифта: «обычный» / «крупный». Зеркало Android TokenStorage.isLargeFont().
// Применяется через data-атрибут на <html> (см. index.css html[data-font='large']).
const KEY = 'dacha_font_large'

export function isLargeFont(): boolean {
  return localStorage.getItem(KEY) === '1'
}

export function applyFontScale(large = isLargeFont()): void {
  document.documentElement.dataset.font = large ? 'large' : 'normal'
}

export function setLargeFont(large: boolean): void {
  localStorage.setItem(KEY, large ? '1' : '0')
  applyFontScale(large)
}
