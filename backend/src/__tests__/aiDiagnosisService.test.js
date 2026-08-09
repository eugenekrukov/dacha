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

    // 5 кандидатов в списке культуры — большой список, top-N ограничение (3) реально что-то
    // отбирает, а не пересказывает весь справочник (см. тест на маленьких списках ниже).
    const svc = require('../services/aiDiagnosisService')
    const result = await svc.diagnose({
      imageBuffer: Buffer.from('fake-image-bytes'),
      cropName: 'Томат',
      candidates: [
        { id: 8, name: 'Фитофтороз', kind: 'disease' },
        { id: 61, name: 'Вершинная гниль', kind: 'disease' },
        { id: 10, name: 'Серая гниль', kind: 'disease' },
        { id: 73, name: 'Кладоспориоз', kind: 'disease' },
        { id: 16, name: 'Фузариоз', kind: 'disease' }
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
    // Промпт просит модель ограничиться разумным числом, не всем списком.
    expect(body.messages[0].content).toContain('не более 3 наиболее вероятных вариантов')

    expect(result.candidates).toHaveLength(2)
    expect(result.candidates[0].id).toBe(8)
    expect(result.model).toBe('qwen-vl-plus')
  })

  it('diagnose(): маленький список кандидатов → выводим строго меньше, чем весь список', async () => {
    const svc = require('../services/aiDiagnosisService')

    // 2 кандидата у культуры, модель (недобросовестно) вернула оба — сервис обрезает до 1,
    // иначе это не диагноз, а пересказ всего справочника культуры (жалоба пользователя).
    const fakeFetchTwo = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ candidates: [
          { id: 1, name: 'А', confidence: 'high', reasoning: 'r1' },
          { id: 2, name: 'Б', confidence: 'medium', reasoning: 'r2' }
        ] }) } }],
        usage: {}
      })
    })
    const resultTwo = await svc.diagnose({
      imageBuffer: Buffer.from('x'),
      cropName: 'Редкая культура',
      candidates: [{ id: 1, name: 'А', kind: 'disease' }, { id: 2, name: 'Б', kind: 'pest' }],
      fetchImpl: fakeFetchTwo
    })
    expect(resultTwo.candidates).toHaveLength(1)
    const promptTwo = JSON.parse(fakeFetchTwo.mock.calls[0][1].body).messages[0].content
    expect(promptTwo).toContain('1 наиболее вероятный вариант')

    // Единственный кандидат у культуры — тут не 1 из 2, а честный единственный ответ, обрезать
    // до 0 бессмысленно.
    const fakeFetchOne = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ candidates: [
          { id: 1, name: 'А', confidence: 'high', reasoning: 'r1' }
        ] }) } }],
        usage: {}
      })
    })
    const resultOne = await svc.diagnose({
      imageBuffer: Buffer.from('x'),
      cropName: 'Культура с одной болезнью',
      candidates: [{ id: 1, name: 'А', kind: 'disease' }],
      fetchImpl: fakeFetchOne
    })
    expect(resultOne.candidates).toHaveLength(1)
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

  it('diagnose(): HTTP error (res.ok=false) → throws with status', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    const svc = require('../services/aiDiagnosisService')
    await expect(
      svc.diagnose({
        imageBuffer: Buffer.from('x'),
        cropName: 'Tomato',
        candidates: [{ id: 1, name: 'Test', kind: 'disease' }],
        fetchImpl: fakeFetch
      })
    ).rejects.toThrow(/HTTP 500/)
  })

  it('diagnose(): модель вернула id не из списка кандидатов → отфильтрован', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              candidates: [
                { id: 8, name: 'Valid', confidence: 'high', reasoning: 'ok' },
                { id: 999, name: 'Hallucinated', confidence: 'high', reasoning: 'not in list' }
              ]
            })
          }
        }],
        usage: {}
      })
    })
    const svc = require('../services/aiDiagnosisService')
    const result = await svc.diagnose({
      imageBuffer: Buffer.from('x'),
      cropName: 'Tomato',
      candidates: [{ id: 8, name: 'Valid', kind: 'disease' }], // только id=8 валиден
      fetchImpl: fakeFetch
    })
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].id).toBe(8)
  })
})
