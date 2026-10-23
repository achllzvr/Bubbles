import { callCloudAi } from './cloud'
import { heuristicParse } from './heuristic'
import type { AiRequest, AiResponse } from './types'
import type { CloudProvider } from '../db/schema'
import type { WorkerInMessage, WorkerOutMessage } from './worker'

type ProgressCb = (text: string, progress: number) => void

let worker: Worker | null = null
let ready = false
let initPromise: Promise<void> | null = null

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  }
  return worker
}

export function isLocalModelReady() {
  return ready
}

export function initLocalModel(
  modelId: string,
  onProgress?: ProgressCb,
): Promise<void> {
  if (initPromise) return initPromise

  initPromise = new Promise((resolve, reject) => {
    const w = getWorker()

    const onMessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data
      if (msg.type === 'progress') {
        onProgress?.(msg.text, msg.progress)
      } else if (msg.type === 'ready') {
        ready = true
        w.removeEventListener('message', onMessage)
        resolve()
      } else if (msg.type === 'error') {
        initPromise = null
        w.removeEventListener('message', onMessage)
        reject(new Error(msg.error))
      }
    }

    w.addEventListener('message', onMessage)
    const payload: WorkerInMessage = { type: 'init', modelId }
    w.postMessage(payload)
  })

  return initPromise
}

function chatLocal(req: AiRequest): Promise<AiResponse> {
  return new Promise((resolve, reject) => {
    if (!ready) {
      reject(new Error('Local model not ready'))
      return
    }

    const requestId = crypto.randomUUID()
    const w = getWorker()

    const onMessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data
      if (msg.type !== 'chat-result' || msg.requestId !== requestId) return
      w.removeEventListener('message', onMessage)
      if (!msg.ok) {
        reject(new Error(msg.error))
        return
      }
      resolve({
        reply: msg.reply,
        tasks: msg.tasks,
        source: 'local',
      })
    }

    w.addEventListener('message', onMessage)
    const payload: WorkerInMessage = {
      type: 'chat',
      requestId,
      message: req.message,
      history: req.history,
    }
    w.postMessage(payload)
  })
}

export interface RouterOptions {
  cloudProvider: CloudProvider
  cloudApiKey: string
  preferCloud: boolean
}

export async function routeAi(
  req: AiRequest,
  options: RouterOptions,
): Promise<AiResponse> {
  const online = typeof navigator !== 'undefined' ? navigator.onLine : false
  const canCloud = online && options.preferCloud && options.cloudApiKey.trim().length > 0

  if (canCloud) {
    try {
      return await callCloudAi(options.cloudProvider, options.cloudApiKey.trim(), req)
    } catch {
      // fall through to local
    }
  }

  if (ready) {
    try {
      return await chatLocal(req)
    } catch {
      // fall through to heuristic
    }
  }

  return heuristicParse(req.message)
}
