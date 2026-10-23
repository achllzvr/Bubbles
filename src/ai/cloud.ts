import { AI_SYSTEM_PROMPT, parseAiJson, type AiRequest, type AiResponse } from './types'
import type { CloudProvider } from '../db/schema'

async function callGemini(apiKey: string, req: AiRequest): Promise<string> {
  const contents = [
    ...(req.history ?? []).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: req.message }] },
  ]

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: AI_SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text) throw new Error('Empty Gemini response')
  return text
}

async function callOpenAI(apiKey: string, req: AiRequest): Promise<string> {
  const messages = [
    { role: 'system', content: AI_SYSTEM_PROMPT },
    ...(req.history ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: req.message },
  ]

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('Empty OpenAI response')
  return text
}

export async function callCloudAi(
  provider: CloudProvider,
  apiKey: string,
  req: AiRequest,
): Promise<AiResponse> {
  const raw = provider === 'openai' ? await callOpenAI(apiKey, req) : await callGemini(apiKey, req)
  const parsed = parseAiJson(raw, req.message)
  if (!parsed) throw new Error('Cloud AI returned invalid JSON')
  return { ...parsed, source: 'cloud' }
}
