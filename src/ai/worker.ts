/// <reference lib="webworker" />
import { CreateMLCEngine, type MLCEngineInterface } from '@mlc-ai/web-llm'
import { AI_SYSTEM_PROMPT, parseAiJson, type AiTaskSuggestion } from './types'
import { DEFAULT_MODEL_ID } from '../db/schema'

export type WorkerInMessage =
  | { type: 'init'; modelId?: string }
  | {
      type: 'chat'
      requestId: string
      message: string
      history?: { role: 'user' | 'assistant'; content: string }[]
    }

export type WorkerOutMessage =
  | { type: 'progress'; text: string; progress: number }
  | { type: 'ready'; modelId: string }
  | { type: 'error'; error: string }
  | {
      type: 'chat-result'
      requestId: string
      ok: true
      reply: string
      tasks: AiTaskSuggestion[]
      raw: string
    }
  | { type: 'chat-result'; requestId: string; ok: false; error: string }

declare const self: DedicatedWorkerGlobalScope

let engine: MLCEngineInterface | null = null

function post(msg: WorkerOutMessage) {
  self.postMessage(msg)
}

async function init(modelId = DEFAULT_MODEL_ID) {
  engine = await CreateMLCEngine(modelId, {
    initProgressCallback: (report) => {
      post({
        type: 'progress',
        text: report.text,
        progress: report.progress ?? 0,
      })
    },
  })
  post({ type: 'ready', modelId })
}

async function chat(
  requestId: string,
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
) {
  if (!engine) {
    post({ type: 'chat-result', requestId, ok: false, error: 'Model not ready' })
    return
  }

  try {
    const messages = [
      { role: 'system' as const, content: AI_SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message },
    ]

    const result = await engine.chat.completions.create({
      messages,
      temperature: 0.2,
      max_tokens: 800,
    })

    const raw = result.choices[0]?.message?.content ?? ''
    const parsed = parseAiJson(raw, message)
    if (!parsed) {
      post({
        type: 'chat-result',
        requestId,
        ok: false,
        error: 'Local model returned invalid JSON',
      })
      return
    }

    post({
      type: 'chat-result',
      requestId,
      ok: true,
      reply: parsed.reply,
      tasks: parsed.tasks,
      raw,
    })
  } catch (err) {
    post({
      type: 'chat-result',
      requestId,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const data = event.data
  void (async () => {
    try {
      if (data.type === 'init') {
        await init(data.modelId)
      } else if (data.type === 'chat') {
        await chat(data.requestId, data.message, data.history)
      }
    } catch (err) {
      post({ type: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  })()
}
