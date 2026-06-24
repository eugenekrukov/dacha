'use strict'

// CLI-постинг одного готового поста в сообщество ВК (ручной/разовый).
// Движок — src/services/vkService.js (его же использует джоб-зеркало Дзена).
//
// Запуск (из каталога backend):
//   node scripts/vk-autopost.js --text-file post.txt --image cover.jpg --link https://dacha.studio1008.com
//   node scripts/vk-autopost.js --text "Короткий пост" --link https://dacha.studio1008.com
//   node scripts/vk-autopost.js --text-file post.txt --dry        # ничего не шлёт, печатает предпросмотр
//
// --image принимает локальный путь ИЛИ URL.
// В .env нужны: VK_GROUP_ID (число без минуса), VK_ACCESS_TOKEN (ключ сообщества с правами wall+photos).

const fs = require('fs')
require('dotenv').config()
const vkService = require('../src/services/vkService')

function parseArgs(argv) {
  const a = {}
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--dry') a.dry = true
    else if (k.startsWith('--')) { a[k.slice(2)] = argv[i + 1]; i++ }
  }
  return a
}

async function main() {
  const a = parseArgs(process.argv.slice(2))
  const text = a['text-file'] ? fs.readFileSync(a['text-file'], 'utf8').trim() : a.text
  if (!text) { console.error('Нужен --text "…" или --text-file <path>'); process.exit(1) }

  const groupId = process.env.VK_GROUP_ID
  const token = process.env.VK_ACCESS_TOKEN

  if (a.dry) {
    console.log(`[dry-run] Пост в сообщество ${groupId ? vkService.wallOwnerId(groupId) : '(VK_GROUP_ID не задан)'}`)
    console.log('--- текст ---\n' + text)
    if (a.image) console.log('\n--- фото ---', a.image)
    if (a.link) console.log('--- ссылка (первым комментарием) ---', a.link)
    return
  }

  if (!groupId || !token) {
    console.error('В .env не заданы VK_GROUP_ID и/или VK_ACCESS_TOKEN'); process.exit(1)
  }

  const vk = vkService.createVk({ token })
  let photo = null
  if (a.image) photo = await vkService.uploadWallPhoto(vk, groupId, await vkService.loadImageBytes(a.image))
  const postId = await vkService.postToWall(vk, { groupId, message: text, photo, link: a.link })
  console.log('Опубликовано:', vkService.postUrl(groupId, postId))
}

if (require.main === module) {
  main().catch((e) => { console.error('Ошибка:', e.message); process.exit(1) })
}

module.exports = { parseArgs }
