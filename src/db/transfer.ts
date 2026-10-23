import { db, ensureSettings, type AppSettings, type ChatMessage, type Session, type Task } from './schema'

export const TRANSFER_VERSION = 1

export interface BubblesArchive {
  version: number
  exportedAt: number
  tasks: Task[]
  sessions: Session[]
  chatMessages: ChatMessage[]
  settings: Omit<AppSettings, 'cloudApiKey'> & { cloudApiKey?: never }
}

function stripSecrets(settings: AppSettings): BubblesArchive['settings'] {
  const { cloudApiKey: _omit, ...rest } = settings
  void _omit
  return rest
}

async function gzipEncode(text: string): Promise<Blob> {
  if (typeof CompressionStream !== 'undefined') {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
    return new Response(stream).blob()
  }
  return new Blob([text], { type: 'application/json' })
}

async function gunzipDecode(buffer: ArrayBuffer): Promise<string> {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))
      return await new Response(stream).text()
    } catch {
      // fall through — maybe uncompressed JSON
    }
  }
  return new TextDecoder().decode(buffer)
}

export async function buildArchive(): Promise<BubblesArchive> {
  const [tasks, sessions, chatMessages, settings] = await Promise.all([
    db.tasks.toArray(),
    db.sessions.toArray(),
    db.chatMessages.toArray(),
    ensureSettings(),
  ])

  return {
    version: TRANSFER_VERSION,
    exportedAt: Date.now(),
    tasks,
    sessions,
    chatMessages,
    settings: stripSecrets(settings),
  }
}

export async function exportBubblesFile(): Promise<void> {
  const archive = await buildArchive()
  const json = JSON.stringify(archive)
  const blob = await gzipEncode(json)
  const stamped = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const useGzip = typeof CompressionStream !== 'undefined'
  const filename = `bubbles-${stamped}.${useGzip ? 'bubbles.gz' : 'bubbles.json'}`
  const file = new File([blob], filename, {
    type: useGzip ? 'application/gzip' : 'application/json',
  })

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Bubbles backup' })
      return
    } catch {
      // user cancelled or share failed — fall through to download
    }
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function importBubblesFile(file: File): Promise<void> {
  const buffer = await file.arrayBuffer()
  const text = await gunzipDecode(buffer)
  const data = JSON.parse(text) as BubblesArchive

  if (!data || typeof data.version !== 'number' || !Array.isArray(data.tasks)) {
    throw new Error('Invalid Bubbles archive')
  }
  if (data.version > TRANSFER_VERSION) {
    throw new Error(`Archive version ${data.version} is newer than this app`)
  }

  await db.transaction('rw', db.tasks, db.sessions, db.chatMessages, db.settings, async () => {
    await Promise.all([
      db.tasks.clear(),
      db.sessions.clear(),
      db.chatMessages.clear(),
    ])

    // Preserve IDs so parentId / linkedTaskIds stay valid
    if (data.tasks.length) await db.tasks.bulkPut(data.tasks)
    if (data.sessions.length) await db.sessions.bulkPut(data.sessions)
    if (data.chatMessages.length) await db.chatMessages.bulkPut(data.chatMessages)

    const current = await ensureSettings()
    if (data.settings) {
      await db.settings.put({
        ...current,
        ...data.settings,
        id: 1,
        cloudApiKey: current.cloudApiKey,
        modelReady: current.modelReady,
      })
    }
  })
}
