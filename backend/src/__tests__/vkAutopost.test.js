'use strict'

const {
  wallOwnerId, attachmentOf, postToWall, uploadWallPhoto, postUrl
} = require('../services/vkService')
const { parseArgs } = require('../../scripts/vk-autopost')

// Поддельный VK-клиент: пишет вызовы в calls[], fetchImpl имитирует ответ upload-сервера.
function fakeVk(responses) {
  const calls = []
  return {
    calls,
    call: async (method, params) => { calls.push({ method, params }); return responses[method] },
    fetchImpl: async () => ({ json: async () => ({ server: 1, photo: 'p', hash: 'h' }) })
  }
}

describe('vkService', () => {
  it('wallOwnerId: id сообщества → отрицательный owner_id (идемпотентно к знаку)', () => {
    expect(wallOwnerId('123')).toBe(-123)
    expect(wallOwnerId(123)).toBe(-123)
    expect(wallOwnerId(-123)).toBe(-123)
  })

  it('attachmentOf формирует photo{owner}_{id}', () => {
    expect(attachmentOf({ owner_id: -10, id: 55 })).toBe('photo-10_55')
  })

  it('postUrl собирает ссылку на пост', () => {
    expect(postUrl(50, 77)).toBe('https://vk.com/wall-50_77')
  })

  it('postToWall: пост от группы с фото + ссылка первым комментарием', async () => {
    const vk = fakeVk({ 'wall.post': { post_id: 77 }, 'wall.createComment': { comment_id: 1 } })
    const id = await postToWall(vk, {
      groupId: 50, message: 'привет', photo: { owner_id: -50, id: 9 },
      link: 'https://dacha.studio1008.com'
    })
    expect(id).toBe(77)
    const post = vk.calls.find((c) => c.method === 'wall.post')
    expect(post.params).toMatchObject({
      owner_id: -50, from_group: 1, message: 'привет', attachments: 'photo-50_9'
    })
    const comment = vk.calls.find((c) => c.method === 'wall.createComment')
    // Комментарий от лица админа (без from_group — community-комментарий требует community-токена).
    expect(comment.params).toMatchObject({
      owner_id: -50, post_id: 77, message: 'https://dacha.studio1008.com'
    })
    expect(comment.params.from_group).toBeUndefined()
  })

  it('postToWall: без ссылки комментарий не создаётся; без фото нет attachments', async () => {
    const vk = fakeVk({ 'wall.post': { post_id: 5 } })
    await postToWall(vk, { groupId: 1, message: 'x' })
    const post = vk.calls.find((c) => c.method === 'wall.post')
    expect(post.params.attachments).toBeUndefined()
    expect(vk.calls.some((c) => c.method === 'wall.createComment')).toBe(false)
  })

  it('uploadWallPhoto: getWallUploadServer → upload → saveWallPhoto', async () => {
    const vk = fakeVk({
      'photos.getWallUploadServer': { upload_url: 'https://up.vk/123' },
      'photos.saveWallPhoto': [{ owner_id: -50, id: 42 }]
    })
    const photo = await uploadWallPhoto(vk, 50, Buffer.from('img'))
    expect(photo).toEqual({ owner_id: -50, id: 42 })
    expect(vk.calls.map((c) => c.method)).toEqual(['photos.getWallUploadServer', 'photos.saveWallPhoto'])
    const save = vk.calls.find((c) => c.method === 'photos.saveWallPhoto')
    expect(save.params).toMatchObject({ group_id: 50, server: 1, photo: 'p', hash: 'h' })
  })

  it('parseArgs: флаги со значениями + булев --dry', () => {
    expect(parseArgs(['--text', 'hi', '--link', 'u', '--dry'])).toEqual({ text: 'hi', link: 'u', dry: true })
    expect(parseArgs(['--text-file', 'post.txt'])).toEqual({ 'text-file': 'post.txt' })
  })
})
