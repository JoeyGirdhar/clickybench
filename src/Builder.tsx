import { useRef, useState } from 'react'
import type { Annotation, AnnotationKind, Step, Walkthrough } from './types'
import { Frame } from './canvas'

const TOOLS: { kind: AnnotationKind; label: string; hint: string }[] = [
  { kind: 'arrow', label: 'Arrow', hint: 'drag from tail to head' },
  { kind: 'ellipse', label: 'Circle', hint: 'drag to size' },
  { kind: 'badge', label: 'Badge', hint: 'click to place' },
  { kind: 'spotlight', label: 'Spotlight', hint: 'drag a region' },
]

/** Badges read as a sequence across the walkthrough, so renumber in step order. */
export function renumberBadges(steps: Step[]): Step[] {
  let n = 0
  return steps.map((s) =>
    s.annotation?.kind === 'badge' ? { ...s, annotation: { ...s.annotation, n: ++n } } : s,
  )
}

export default function Builder({
  wt, setWt, selectedId, setSelectedId, onPickImages,
}: {
  wt: Walkthrough
  setWt: (w: Walkthrough) => void
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  onPickImages: (files: FileList | null, replaceId?: string) => void
}) {
  const [tool, setTool] = useState<AnnotationKind>('arrow')
  const dragFrom = useRef<number | null>(null)
  const addRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)

  const index = wt.steps.findIndex((s) => s.id === selectedId)
  const step = index >= 0 ? wt.steps[index] : null
  const setSteps = (steps: Step[]) => setWt({ ...wt, steps: renumberBadges(steps) })
  const patch = (p: Partial<Step>) =>
    step && setSteps(wt.steps.map((s) => (s.id === step.id ? { ...s, ...p } : s)))

  const remove = (id: string) => {
    const next = wt.steps.filter((s) => s.id !== id)
    setSteps(next)
    if (id === selectedId) setSelectedId(next[Math.min(index, next.length - 1)]?.id ?? null)
  }

  const reorder = (to: number) => {
    const from = dragFrom.current
    dragFrom.current = null
    if (from === null || from === to) return
    const next = [...wt.steps]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setSteps(next)
  }

  // Number the badge about to be placed: one past the badges before this step.
  const nextBadge =
    1 + wt.steps.slice(0, Math.max(index, 0)).filter((s) => s.annotation?.kind === 'badge').length

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-72 shrink-0 flex-col border-r border-neutral-800">
        <div className="border-b border-neutral-800 p-3">
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-neutral-500">Title</label>
          <input
            value={wt.title}
            onChange={(e) => setWt({ ...wt, title: e.target.value })}
            placeholder="Untitled walkthrough"
            className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
          />
        </div>

        <div className="flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-wider text-neutral-500">
          <span>Steps</span>
          <span>{wt.steps.length}</span>
        </div>

        <ol className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {wt.steps.map((s, i) => (
            <li
              key={s.id}
              draggable
              onDragStart={() => (dragFrom.current = i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => reorder(i)}
              onClick={() => setSelectedId(s.id)}
              className={
                'group mb-1 flex cursor-pointer items-center gap-2 rounded border p-1.5 text-sm ' +
                (s.id === selectedId
                  ? 'border-amber-500/60 bg-neutral-800/60'
                  : 'border-transparent hover:bg-neutral-900')
              }
            >
              <span className="w-4 shrink-0 text-right text-xs tabular-nums text-neutral-500">{i + 1}</span>
              <img
                src={s.image}
                alt=""
                className="h-8 w-12 shrink-0 rounded-sm border border-neutral-800 object-cover"
              />
              <span
                className={
                  'min-w-0 flex-1 truncate ' + (s.intent ? 'text-neutral-300' : 'italic text-neutral-600')
                }
              >
                {s.intent || 'no intent yet'}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  remove(s.id)
                }}
                title="Delete step"
                className="shrink-0 px-1 text-neutral-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
              >
                &times;
              </button>
            </li>
          ))}
          {wt.steps.length === 0 && (
            <li className="px-2 py-6 text-xs leading-relaxed text-neutral-600">
              Paste a screenshot anywhere to start a step. Drag and drop works too.
            </li>
          )}
        </ol>

        <div className="border-t border-neutral-800 p-3">
          <button
            onClick={() => addRef.current?.click()}
            className="w-full rounded border border-neutral-700 px-3 py-1.5 text-sm hover:border-neutral-500"
          >
            Add screenshots
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-neutral-600">
            Paste (Cmd/Ctrl+V) is the fast path. Drop a .json on the window to import.
          </p>
          <input
            ref={addRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              onPickImages(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        {!step ? (
          <div className="flex h-full items-center justify-center p-10">
            <div className="max-w-md text-sm leading-relaxed text-neutral-500">
              <p className="mb-2 text-neutral-300">No steps yet.</p>
              <p>
                Take a screenshot and paste it here, drop image files on the window, or use Add
                screenshots. To see a finished walkthrough, hit Import and open{' '}
                <span className="text-neutral-400">examples/example.json</span>.
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs text-neutral-500">
                Step {index + 1} of {wt.steps.length}
              </span>
              {TOOLS.map((t) => (
                <button
                  key={t.kind}
                  onClick={() => setTool(t.kind)}
                  title={t.hint}
                  className={
                    'rounded border px-2.5 py-1 text-xs ' +
                    (tool === t.kind
                      ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                      : 'border-neutral-700 text-neutral-400 hover:border-neutral-500')
                  }
                >
                  {t.label}
                </button>
              ))}
              <span className="text-xs text-neutral-600">{TOOLS.find((t) => t.kind === tool)?.hint}</span>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => patch({ annotation: null })}
                  className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 hover:border-neutral-500"
                >
                  Clear annotation
                </button>
                <button
                  onClick={() => replaceRef.current?.click()}
                  className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 hover:border-neutral-500"
                >
                  Replace image
                </button>
                <input
                  ref={replaceRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    onPickImages(e.target.files, step.id)
                    e.target.value = ''
                  }}
                />
              </div>
            </div>

            <Frame
              step={step}
              annotation={step.annotation}
              tool={tool}
              badgeNumber={nextBadge}
              onDraw={(a: Annotation) => patch({ annotation: a })}
            />

            <div className="mt-4 grid gap-3">
              <div>
                <label className="mb-1 flex items-baseline gap-2 text-[11px] uppercase tracking-wider text-neutral-500">
                  Intent
                  <span className="normal-case tracking-normal text-neutral-600">
                    what this step means, not what it looked like
                  </span>
                </label>
                <input
                  value={step.intent}
                  onChange={(e) => patch({ intent: e.target.value })}
                  placeholder="open the Effects panel"
                  className="w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
                />
              </div>
              <div>
                <label className="mb-1 flex items-baseline gap-2 text-[11px] uppercase tracking-wider text-neutral-500">
                  Note
                  <span className="normal-case tracking-normal text-neutral-600">optional, for a human</span>
                </label>
                <textarea
                  value={step.note}
                  onChange={(e) => patch({ note: e.target.value })}
                  rows={2}
                  placeholder="A sentence or two of explanation."
                  className="w-full resize-y rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
