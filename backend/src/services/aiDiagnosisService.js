'use strict'

const fetch = require('node-fetch')

// AI-диагностика по фото (F2, closed-set): фото + список кандидатов ИЗ СВОЕГО guide_entries
// (не открытый вопрос) → Qwen-VL выбирает топ-N по обоснованию. Прототип (2026-08-09):
// open-set 20% точности, closed-set 65-94% в зависимости от типа поражения (память
// project_dacha_ai_diagnosis.md). Включается AI_DIAGNOSIS_API_KEY (паттерн nalogService/isEnabled).
//
// ponytail: без цепочки бесплатных моделей (в отличие от Tender openai_compatible_client.py) —
// у Dacha мало клиентов, усложнять фолбэками пока незачем. Добавить, если реально упрёмся в квоту.

const BASE_URL = () => process.env.AI_DIAGNOSIS_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
const MODEL = () => process.env.AI_DIAGNOSIS_MODEL || 'qwen-vl-plus'
const TIMEOUT_MS = 30000

function isEnabled() {
  return !!process.env.AI_DIAGNOSIS_API_KEY
}

// Сколько кандидатов реально показывать. У многих культур в справочнике всего 1-2 болезни/
// вредителя — фиксированные «топ-2-3» на таком списке вырождаются в пересказ всего справочника
// (не отбор, а дамп), выглядит как обман. Правило: показываем строго МЕНЬШЕ, чем весь список
// (кроме единственного варианта — там отбирать физически не из чего, это честный единственный
// ответ). 1→1, 2→1, 3-4→2, 5+→3.
function maxOutputCandidates(totalCandidates) {
  if (totalCandidates <= 1) return 1
  return Math.min(3, totalCandidates - 1)
}

function buildSystem(maxN) {
  const countPhrase = maxN === 1 ? '1 наиболее вероятный вариант' : `не более ${maxN} наиболее вероятных вариантов`
  return (
    'Ты агроном-эксперт. Тебе дано фото и ЗАКРЫТЫЙ список возможных болезней/вредителей ' +
    `этой культуры. Выбери ${countPhrase} СТРОГО из списка (по id), ` +
    'от самого вероятного к менее вероятному. Если ни один не подходит — верни пустой массив. ' +
    'Ответ СТРОГО валидным JSON без markdown: {"candidates": [{"id": <int>, "name": "<строго из списка>", ' +
    '"confidence": "high|medium|low", "reasoning": "краткое обоснование по видимым признакам"}]}'
  )
}

function buildPayload(system, userText, dataUrl) {
  return {
    model: MODEL(),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        { type: 'text', text: userText }
      ] }
    ],
    max_tokens: 500,
    temperature: 0,
    response_format: { type: 'json_object' }
  }
}

async function callOnce(payload, fetchImpl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetchImpl(`${BASE_URL()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.AI_DIAGNOSIS_API_KEY}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    if (!res.ok) throw new Error(`AI diagnosis HTTP ${res.status}`)
    const data = await res.json()
    const text = ((data.choices || [])[0] || {}).message?.content || ''
    return { text, usage: data.usage || {} }
  } finally {
    clearTimeout(timer)
  }
}

function parseCandidates(text, validIds, maxN) {
  try {
    const parsed = JSON.parse(text)
    const list = Array.isArray(parsed.candidates) ? parsed.candidates : []
    // Не доверяем модели вслепую: оставляем только id из переданного closed-set списка,
    // и режем до maxN, даже если модель вернула больше, чем просили.
    return list.filter((c) => validIds.has(c.id)).slice(0, maxN)
  } catch {
    return null
  }
}

/**
 * @param {Buffer} imageBuffer - байты фото (уже обработанное webp, 1600px)
 * @param {string} cropName - культура посадки, для контекста промпта
 * @param {{id:number,name:string,kind:string}[]} candidates - closed-set список из guide_entries
 * @param {Function} [fetchImpl] - для тестов; по умолчанию node-fetch
 * @returns {Promise<{candidates: Array, model: string}>}
 */
async function diagnose({ imageBuffer, cropName, candidates, fetchImpl = fetch }) {
  const validIds = new Set(candidates.map((c) => c.id))
  const maxN = maxOutputCandidates(candidates.length)
  const system = buildSystem(maxN)
  const candText = candidates.map((c) => `- id=${c.id}, ${c.kind}: ${c.name}`).join('\n')
  const userText = `Культура: ${cropName}.\nВозможные варианты:\n${candText}\n\nЧто на фото?`
  const dataUrl = `data:image/webp;base64,${imageBuffer.toString('base64')}`

  let { text } = await callOnce(buildPayload(system, userText, dataUrl), fetchImpl)
  let parsed = parseCandidates(text, validIds, maxN)

  if (parsed === null) {
    // Один ретрай с более настойчивой инструкцией — как в Tender openai_compatible_client.
    ;({ text } = await callOnce(
      buildPayload(system, userText + '\n\nВерни ТОЛЬКО JSON-объект, ничего больше.', dataUrl),
      fetchImpl
    ))
    parsed = parseCandidates(text, validIds, maxN) || []
  }

  return { candidates: parsed, model: MODEL() }
}

module.exports = { isEnabled, diagnose }
