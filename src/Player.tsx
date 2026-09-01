import { useEffect, useState } from 'react'
import type { Annotation, PlayMode, Walkthrough } from './types'
import { targetOf } from './types'
import { Frame } from './canvas'

const MODES: { mode: PlayMode; label: string; blurb: string }[] = [
  { mode: 'full', label: 'Full', blurb: 'Intent, annotation and note. Everything shown.' },
  { mode: 'speedrun', label: 'Speedrun', blurb: 'Intent and annotation only. For someone who knows the tool and forgot where a menu moved.' },
  { mode: 'socratic', label: 'Socratic', blurb: 'Intent plus a rough region. You guess where, then reveal the exact spot.' },
]

/**
 * Socratic mode needs a region rather than a point: near enough to be a hint,
 * loose enough to still be a question. Sized in pixels, expressed as percentages.
 */
function hintRegion(a: Annotation, w: number, h: number): Annotation {
  const t = targetOf(a)
  const hw = 12
  const hh = (hw * w) / h
  return {
    kind: 'spotlight',
    x: Math.max(0, t.x - hw),
    y: Math.max(0, t.y - hh),
    w: Math.min(100, t.x + hw) - Math.max(0, t.x - hw),
    h: Math.min(100, t.y + hh) - Math.max(0, t.y - hh),
  }
}

export default function Player({
  wt, onExit, onQuiz,
}: {
  wt: Walkthrough
  onExit: () => void
  onQuiz: () => void
}) {
  const [mode, setMode] = useState<PlayMode>('full')
  const [started, setStarted] = useState(false)
  const [i, setI] = useState(0)
  const [revealed, setRevealed] = useState(false)

  const step = wt.steps[i]
  const last = i === wt.steps.length - 1

  useEffect(() => {
    if (!started) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && !last) { setI((n) => n + 1); setRevealed(false) }
      if (e.key === 'ArrowLeft' && i > 0) { setI((n) => n - 1); setRevealed(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [started, i, last])

  if (!started) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-lg">
          <h2 className="text-lg text-neutral-200">{wt.title || 'Untitled walkthrough'}</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {wt.steps.length} step{wt.steps.length === 1 ? '' : 's'}. Pick a mode.
          </p>
          <div className="mt-4 grid gap-2">
            {MODES.map((m) => (
              <button
                key={m.mode}
                onClick={() => setMode(m.mode)}
                className={
                  'rounded border p-3 text-left ' +
                  (mode === m.mode ? 'border-amber-500 bg-amber-500/5' : 'border-neutral-800 hover:border-neutral-600')
                }
              >
                <div className={'text-sm ' + (mode === m.mode ? 'text-amber-300' : 'text-neutral-300')}>{m.label}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-neutral-500">{m.blurb}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setStarted(true)}
              className="rounded bg-amber-500 px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-amber-400"
            >
              Start
            </button>
            <button onClick={onExit} className="rounded border border-neutral-700 px-4 py-1.5 text-sm text-neutral-400 hover:border-neutral-500">
              Back to builder
            </button>
          </div>
        </div>
      </div>
    )
  }

  const socraticHidden = mode === 'socratic' && !revealed
  const shown: Annotation | null = !step.annotation
    ? null
    : socraticHidden
      ? hintRegion(step.annotation, step.imageWidth, step.imageHeight)
      : step.annotation
  const showNote = step.note && (mode === 'full' || (mode === 'socratic' && revealed))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-4 border-b border-neutral-800 px-4 py-2 text-sm">
        <span className="truncate text-neutral-300">{wt.title || 'Untitled walkthrough'}</span>
        <span className="rounded border border-neutral-700 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-neutral-500">
          {mode}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="whitespace-nowrap tabular-nums text-neutral-500">{i + 1} / {wt.steps.length}</span>
          <div className="hidden h-1 w-32 overflow-hidden rounded bg-neutral-800 sm:block">
            <div className="h-full bg-amber-500" style={{ width: `${((i + 1) / wt.steps.length) * 100}%` }} />
          </div>
          <button onClick={onExit} className="text-neutral-500 hover:text-neutral-300">Exit</button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto p-4">
        <Frame step={step} annotation={shown} maxHeight="60vh" />

        <div className="mt-4 w-full max-w-2xl">
          <p className="text-base text-neutral-100">{step.intent || <span className="italic text-neutral-600">no intent recorded</span>}</p>
          {socraticHidden && (
            <p className="mt-1 text-sm text-neutral-500">Where do you think you do this?</p>
          )}
          {showNote ? <p className="mt-2 text-sm leading-relaxed text-neutral-400">{step.note}</p> : null}

          <div className="mt-5 flex items-center gap-2">
            <button
              disabled={i === 0}
              onClick={() => { setI(i - 1); setRevealed(false) }}
              className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 disabled:opacity-30 enabled:hover:border-neutral-500"
            >
              Prev
            </button>
            {socraticHidden && step.annotation ? (
              <button
                onClick={() => setRevealed(true)}
                className="rounded border border-amber-500 px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-500/10"
              >
                Reveal
              </button>
            ) : null}
            {last ? (
              <button
                onClick={onQuiz}
                className="rounded bg-amber-500 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-amber-400"
              >
                Score me
              </button>
            ) : (
              <button
                onClick={() => { setI(i + 1); setRevealed(false) }}
                className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:border-neutral-500"
              >
                Next
              </button>
            )}
            <span className="ml-2 text-xs text-neutral-600">arrow keys work too</span>
          </div>
        </div>
      </div>
    </div>
  )
}
