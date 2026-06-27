'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')

const GARDEN = { id: 1, user_id: 1 }
const BED = { id: 10, garden_id: 1, name: 'Теплица 1', type: 'greenhouse' }

function makeMockDb(overrides = {}) {
  return { query: async () => ({ rows: [] }), ...overrides }
}

describe('PATCH /beds/:id', () => {
  it('переименовывает грядку своего участка', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('UPDATE garden_beds')) {
          return { rows: [{ ...BED, name: params[0] }] }
        }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .patch('/beds/10')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Грядка у забора' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Грядка у забора')
    await app.close()
  })

  it('404 для чужой грядки', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .patch('/beds/999')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Чужая' })

    expect(res.status).toBe(404)
    await app.close()
  })
})

describe('DELETE /beds/:id', () => {
  it('удаляет грядку своего участка', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => sql.includes('DELETE') ? { rows: [{ id: 10 }] } : { rows: [] },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .delete('/beds/10')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ deleted: true })
    await app.close()
  })

  it('404 для чужой грядки', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .delete('/beds/999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    await app.close()
  })
})
