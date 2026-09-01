import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Step, Walkthrough } from './types'
import { emptyWalkthrough, newId } from './types'
import { SIZE_WARN_BYTES, download, formatBytes, ingestImage, parseWalkthrough, serialize } from './format'
// Inlined at build time as text, so the live site can demo itself without a
// single network call. It goes through the same parser as a real import.
import exampleRaw from '../examples/example.json?raw'
import Builder from './Builder'
import Player from './Player'
import Quiz from './Quiz'

type Screen = 'build' | 'play' | 'quiz'

export default function App() {
  const [wt, setWt] = useState<Walkthrough>(emptyWalkthrough)
  const [screen, setScreen] = useState<Screen>('build')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const json = useMemo(() => serialize(wt), [wt])
  const bytes = useMemo(() => new Blob([json]).size, [json])
  const oversized = bytes > SIZE_WARN_BYTES

  const addImages = useCallback(async (files: File[], replaceId?: string) => {
    setError(null)
    try {
      if (replaceId) {
        const img = await ingestImage(files[0])
        setWt((w) => ({ ...w, steps: w.steps.map((s) => (s.id === replaceId ? { ...s, ...img } : s)) }))
        return
      }
      const made: Step[] = []
      for (const f of files) {
        made.push({ id: newId(), intent: '', note: '', annotation: null, ...(await ingestImage(f)) })
      }
      if (!made.length) return
      setWt((w) => ({ ...w, steps: [...w.steps, ...made] }))
      setSelectedId(made[made.length - 1].id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That image could not be read.')
    }
  }, [])

  const load = useCallback((text: string) => {
    try {
      const next = parseWalkthrough(text)
      setWt(next)
      setSelectedId(next.steps[0]?.id ?? null)
      setScreen('build')
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be imported.')
    }
  }, [])

  const importJson = useCallback(async (file: File) => load(await file.text()), [load])

  const takeFiles = useCallback(
    (list: FileList | null, replaceId?: string) => {
      const files = Array.from(list ?? [])
      const jsonFile = files.find((f) => f.name.endsWith('.json') || f.type === 'application/json')
      if (jsonFile) { void importJson(jsonFile); return }
      const images = files.filter((f) => f.type.startsWith('image/'))
      if (images.length) void addImages(images, replaceId)
    },
    [addImages, importJson],
  )

  // Clipboard is the primary way screenshots get in. Listen for the paste EVENT
  // rather than a Ctrl+V key handler, so Cmd+V on a Mac lands here identically.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (screen !== 'build') return
      const files = Array.from(e.clipboardData?.items ?? [])
        .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter((f): f is File => f !== null)
      if (!files.length) return // plain text paste: leave the focused field alone
      e.preventDefault()
      void addImages(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [screen, addImages])

  useEffect(() => {
    const over = (e: DragEvent) => { e.preventDefault(); setDragging(true) }
    const leave = (e: DragEvent) => { if (!e.relatedTarget) setDragging(false) }
    const drop = (e: DragEvent) => { e.preventDefault(); setDragging(false); takeFiles(e.dataTransfer?.files ?? null) }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [takeFiles])

  return (
    <div className={'flex h-dvh flex-col ' + (dragging ? 'ring-2 ring-inset ring-amber-500' : '')}>
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-800 px-4 py-2">
        <span className="text-sm font-medium tracking-tight text-neutral-100">ClickyBench</span>
        <span className="hidden text-xs text-neutral-600 sm:inline">portable walkthroughs</span>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {screen === 'build' && (
            <>
              <span className={'text-xs tabular-nums ' + (oversized ? 'text-amber-400' : 'text-neutral-600')}>
                {formatBytes(bytes)}
                {oversized ? ' — over 20MB, trim steps before sending' : ''}
              </span>
              <button
                onClick={() => importRef.current?.click()}
                className="rounded border border-neutral-700 px-3 py-1 hover:border-neutral-500"
              >
                Import
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => { takeFiles(e.target.files); e.target.value = '' }}
              />
              <button
                onClick={() => download(wt)}
                disabled={!wt.steps.length}
                className="rounded border border-neutral-700 px-3 py-1 disabled:opacity-30 enabled:hover:border-neutral-500"
              >
                Export
              </button>
              <button
                onClick={() => setScreen('play')}
                disabled={!wt.steps.length}
                className="rounded bg-amber-500 px-3 py-1 font-medium text-neutral-950 disabled:opacity-30 enabled:hover:bg-amber-400"
              >
                Play
              </button>
            </>
          )}
        </div>
      </header>

      {error && (
        <div className="flex shrink-0 items-start gap-3 border-b border-red-900/60 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          <span className="min-w-0 flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/70 hover:text-red-300">dismiss</button>
        </div>
      )}

      {screen === 'build' && (
        <Builder
          wt={wt}
          setWt={setWt}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          onPickImages={takeFiles}
          onLoadExample={() => load(exampleRaw)}
        />
      )}
      {screen === 'play' && (
        <Player wt={wt} onExit={() => setScreen('build')} onQuiz={() => setScreen('quiz')} />
      )}
      {screen === 'quiz' && <Quiz wt={wt} onExit={() => setScreen('build')} />}
    </div>
  )
}
