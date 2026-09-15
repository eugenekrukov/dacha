'use strict'

const { getUserToken, AUTH_URL } = require('../services/vkIdAuth')

const NOW = Date.parse('2026-09-14T12:00:00Z')

function fakeDb(row) {
  const updates = []
  return {
    updates,
    query: async (sql, args) => {
      if (/SELECT[\s\S]*FROM vk_auth/i.test(sql)) return { rows: row ? [row] : [] }
      if (/^\s*UPDATE vk_auth/i.test(sql)) { updates.push(args); return { rows: [] } }
      return { rows: [] }
    }
  }
}

describe('vkIdAuth.getUserToken', () => {
  const env = { VK_ID_CLIENT_ID: '54651185' }

  it('VK ID не подключён (нет refresh token) → null без запросов', async () => {
    const fetchImpl = vi.fn()
    expect(await getUserToken(fakeDb(null), { env, fetchImpl })).toBeNull()
    expect(await getUserToken(fakeDb({ refresh_token: null }), { env, fetchImpl })).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('access token ещё жив → отдаёт его без рефреша', async () => {
    const fetchImpl = vi.fn()
    const db = fakeDb({ access_token: 'a1', refresh_token: 'r1', device_id: 'd1', expires_at: new Date(NOW + 30 * 60000) })
    expect(await getUserToken(db, { env, fetchImpl, now: () => NOW })).toBe('a1')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('истекает (меньше 5 минут) → рефреш, сохраняет новую пару (refresh ротируется)', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ access_token: 'a2', refresh_token: 'r2', expires_in: 3600 }) }))
    const db = fakeDb({ access_token: 'a1', refresh_token: 'r1', device_id: 'd1', expires_at: new Date(NOW + 60000) })
    expect(await getUserToken(db, { env, fetchImpl, now: () => NOW })).toBe('a2')
    const [url, opts] = fetchImpl.mock.calls[0]
    expect(url).toBe(AUTH_URL)
    const body = new URLSearchParams(opts.body)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('r1')
    expect(body.get('client_id')).toBe('54651185')
    expect(body.get('device_id')).toBe('d1')
    expect(body.get('state').length).toBeGreaterThanOrEqual(32)
    expect(db.updates[0].slice(0, 3)).toEqual(['a2', 'r2', 'd1'])
  })

  it('ошибка VK ID при рефреше → null (не роняет вызывающий код), пара сбрасывается', async () => {
    const fetchImpl = async () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant', error_description: 'expired' }) })
    const db = fakeDb({ access_token: null, refresh_token: 'r1', device_id: 'd1', expires_at: null })
    expect(await getUserToken(db, { env, fetchImpl, now: () => NOW })).toBeNull()
    expect(db.updates).toHaveLength(1)
  })
})
