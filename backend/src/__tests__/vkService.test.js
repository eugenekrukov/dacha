'use strict'

const { loadImageBytes } = require('../services/vkService')

describe('vkService.loadImageBytes — защита от SSRF', () => {
  it('блокирует localhost/внутренние/cloud-metadata адреса', async () => {
    const blocked = [
      'http://localhost/x.jpg',
      'http://127.0.0.1/x.jpg',
      'http://10.0.0.5/x.jpg',
      'http://172.16.0.1/x.jpg',
      'http://192.168.1.1/x.jpg',
      'http://169.254.169.254/latest/meta-data/',
    ]
    for (const url of blocked) {
      await expect(loadImageBytes(url, async () => { throw new Error('fetch не должен вызываться') }))
        .rejects.toThrow(/запрещена/)
    }
  })

  it('пропускает обычный внешний https-адрес (fetchImpl вызывается)', async () => {
    let called = false
    const fetchImpl = async () => { called = true; return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) } }
    await loadImageBytes('https://example.com/photo.jpg', fetchImpl)
    expect(called).toBe(true)
  })
})
