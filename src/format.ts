import type { Annotation, Step, Walkthrough } from './types'

/** Long edge, in pixels, that incoming screenshots are downscaled to. */
export const MAX_EDGE = 1600
/** Exports past this get a visible warning. Email attachment territory. */
export const SIZE_WARN_BYTES = 20 * 1024 * 1024

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That file could not be read as an image.'))
    img.src = src
  })
}

/**
 * Take a raw image file and turn it into an embeddable data URL, downscaled to
 * MAX_EDGE on the long edge. Everything the app holds has already been through
 * here, so export is just JSON.stringify.
 */
export async function ingestImage(
  file: Blob,
): Promise<{ image: string; imageWidth: number; imageHeight: number }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const natural = Math.max(img.naturalWidth, img.naturalHeight)
    const scale = natural > MAX_EDGE ? MAX_EDGE / natural : 1
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser would not give us a canvas to resize with.')
    ctx.drawImage(img, 0, 0, w, h)
    // PNG keeps UI text crisp, which matters for screenshots. Fall back to
    // JPEG only when PNG would make the portable file unreasonably heavy.
    let image = canvas.toDataURL('image/png')
    if (image.length > 900_000) image = canvas.toDataURL('image/jpeg', 0.9)
    return { image, imageWidth: w, imageHeight: h }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function num(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function checkAnnotation(a: unknown, where: string): Annotation {
  if (typeof a !== 'object' || a === null) throw new Error(`${where}: annotation must be an object or null.`)
  const o = a as Record<string, unknown>
  const need = (...keys: string[]) => {
    for (const k of keys) {
      if (!num(o[k])) throw new Error(`${where}: annotation of kind "${String(o.kind)}" needs a number "${k}".`)
    }
  }
  switch (o.kind) {
    case 'arrow': need('x1', 'y1', 'x2', 'y2'); break
    case 'ellipse': need('cx', 'cy', 'rx', 'ry'); break
    case 'badge': need('x', 'y', 'n'); break
    case 'spotlight': need('x', 'y', 'w', 'h'); break
    default:
      throw new Error(`${where}: unknown annotation kind ${JSON.stringify(o.kind)}.`)
  }
  return a as Annotation
}

/** Parse and validate a .json file. Throws Error with a message worth showing. */
export function parseWalkthrough(text: string): Walkthrough {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (typeof raw !== 'object' || raw === null) throw new Error('The file should contain a JSON object.')
  const o = raw as Record<string, unknown>
  if (o.format !== 'clickybench/walkthrough') {
    throw new Error('Missing "format": "clickybench/walkthrough". This does not look like a ClickyBench file.')
  }
  if (!Array.isArray(o.steps)) throw new Error('"steps" is missing or is not an array.')

  const steps: Step[] = o.steps.map((s, i) => {
    const where = `Step ${i + 1}`
    if (typeof s !== 'object' || s === null) throw new Error(`${where}: is not an object.`)
    const st = s as Record<string, unknown>
    if (typeof st.intent !== 'string') throw new Error(`${where}: "intent" must be a string.`)
    if (typeof st.image !== 'string' || !st.image.startsWith('data:image/')) {
      throw new Error(`${where}: "image" must be an embedded data URL starting with "data:image/".`)
    }
    if (!num(st.imageWidth) || !num(st.imageHeight)) {
      throw new Error(`${where}: "imageWidth" and "imageHeight" must be numbers.`)
    }
    return {
      id: typeof st.id === 'string' ? st.id : `step-${i}`,
      intent: st.intent,
      note: typeof st.note === 'string' ? st.note : '',
      image: st.image,
      imageWidth: st.imageWidth,
      imageHeight: st.imageHeight,
      annotation: st.annotation == null ? null : checkAnnotation(st.annotation, where),
    }
  })

  return {
    format: 'clickybench/walkthrough',
    version: 1,
    title: typeof o.title === 'string' ? o.title : 'Untitled walkthrough',
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
    steps,
  }
}

export function serialize(w: Walkthrough): string {
  return JSON.stringify(w, null, 2)
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function download(w: Walkthrough): void {
  const slug = (w.title || 'walkthrough').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const blob = new Blob([serialize(w)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug || 'walkthrough'}.json`
  a.click()
  URL.revokeObjectURL(url)
}
