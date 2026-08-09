'use strict'

describe('aiDiagnosisService', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    process.env = { ...OLD_ENV, AI_DIAGNOSIS_API_KEY: 'test-key' }
  })
  afterEach(() => { process.env = OLD_ENV })

  it('isEnabled() true только с ключом', () => {
    const svc = require('../services/aiDiagnosisService')
    expect(svc.isEnabled()).toBe(true)
    process.env.AI_DIAGNOSIS_API_KEY = ''
    expect(svc.isEnabled()).toBe(false)
  })

  it('diagnose(): шлёт closed-set промпт, парсит топ-кандидаты из JSON-ответа', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              candidates: [
                { id: 8, name: 'Фитофтороз', confidence: 'high', reasoning: 'Бурые пятна на плодах' },
                { id: 61, name: 'Вершинная гниль', confidence: 'medium', reasoning: 'Похожее потемнение' }
              ]
            })
          }
        }],
        usage: { prompt_tokens: 800, completion_tokens: 120 }
      })
    })

    const svc = require('../services/aiDiagnosisService')
    const result = await svc.diagnose({
      imageBuffer: Buffer.from('fake-image-bytes'),
      cropName: 'Томат',
      candidates: [
        { id: 8, name: 'Фитофтороз', kind: 'disease' },
        { id: 61, name: 'Вершинная гниль', kind: 'disease' }
      ],
      fetchImpl: fakeFetch
    })

    expect(fakeFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = fakeFetch.mock.calls[0]
    expect(url).toContain('/chat/completions')
    const body = JSON.parse(opts.body)
    expect(body.model).toBe('qwen-vl-plus')
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages[1].content[1].text).toContain('Томат')
    expect(body.messages[1].content[1].text).toContain('Фитофтороз')

    expect(result.candidates).toHaveLength(2)
    expect(result.candidates[0].id).toBe(8)
    expect(result.model).toBe('qwen-vl-plus')
  })

  it('diagnose(): невалидный JSON в ответе → один ретрай, затем null-кандидаты', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'не JSON, простите' } }], usage: {} })
    })
    const svc = require('../services/aiDiagnosisService')
    const result = await svc.diagnose({
      imageBuffer: Buffer.from('x'),
      cropName: 'Огурец',
      candidates: [{ id: 1, name: 'Тест', kind: 'disease' }],
      fetchImpl: fakeFetch
    })
    expect(fakeFetch).toHaveBeenCalledTimes(2) // ретрай
    expect(result.candidates).toEqual([])
  })
})
