import { useState } from 'react'
import type { Step, Walkthrough } from './types'
import { targetOf } from './types'
import { ACCENT, Frame, GUESS, Marker, type Pt } from './canvas'

const QUESTIONS = 3

/** A hit is generous on big screenshots and never tighter than 40px. */
function tolerance(step: Step): number {
  return Math.max(40, 0.04 * Math.max(step.imageWidth, step.imageHeight))
}

function pickSteps(wt: Walkthrough): Step[] {
  const scorable = wt.steps.filter((s) => s.annotation)
  const shuffled = [...scorable].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(QUESTIONS, scorable.length))
}

interface Answer { guess: Pt; distance: number; hit: boolean }

export default function Quiz({ wt, onExit }: { wt: Walkthrough; onExit: () => void }) {
  const [steps] = useState(() => pickSteps(wt))
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])

  if (steps.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm text-sm leading-relaxed text-neutral-500">
          <p className="mb-2 text-neutral-300">Nothing to score.</p>
          <p>The quiz asks you to click where each step happens, so it needs steps that carry an annotation.</p>
          <button onClick={onExit} className="mt-4 rounded border border-neutral-700 px-3 py-1.5 text-neutral-300 hover:border-neutral-500">
            Back to builder
          </button>
        </div>
      </div>
    )
  }

  const done = i >= steps.length
  if (done) {
    const hits = answers.filter((a) => a.hit).length
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-lg">
          <div className="text-3xl tabular-nums text-neutral-100">{hits} / {steps.length}</div>
          <p className="mt-1 text-sm text-neutral-500">{wt.title || 'Untitled walkthrough'}</p>
          <ul className="mt-5 divide-y divide-neutral-800 border-y border-neutral-800">
            {steps.map((s, n) => (
              <li key={s.id} className="flex items-baseline gap-3 py-2 text-sm">
                <span className={answers[n]?.hit ? 'text-emerald-400' : 'text-red-400'}>
                  {answers[n]?.hit ? 'hit' : 'miss'}
                </span>
                <span className="min-w-0 flex-1 truncate text-neutral-300">{s.intent || 'no intent recorded'}</span>
                <span className="tabular-nums text-neutral-600">{Math.round(answers[n]?.distance ?? 0)}px</span>
              </li>
            ))}
          </ul>
          <button onClick={onExit} className="mt-5 rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:border-neutral-500">
            Back to builder
          </button>
        </div>
      </div>
    )
  }

  const step = steps[i]
  const answer = answers[i]
  const target = step.annotation ? targetOf(step.annotation) : { x: 50, y: 50 }

  const submit = (p: Pt) => {
    const dx = ((p.x - target.x) / 100) * step.imageWidth
    const dy = ((p.y - target.y) / 100) * step.imageHeight
    const distance = Math.hypot(dx, dy)
    setAnswers([...answers, { guess: p, distance, hit: distance <= tolerance(step) }])
  }

  const px = (p: Pt) => ({ x: (p.x / 100) * step.imageWidth, y: (p.y / 100) * step.imageHeight })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-4 border-b border-neutral-800 px-4 py-2 text-sm">
        <span className="text-neutral-300">Score</span>
        <span className="text-neutral-500">click where this happens</span>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="whitespace-nowrap tabular-nums text-neutral-500">{i + 1} / {steps.length}</span>
          <button onClick={onExit} className="text-neutral-500 hover:text-neutral-300">Exit</button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto p-4">
        <p className="mb-3 max-w-2xl text-center text-base text-neutral-100">
          {step.intent || <span className="italic text-neutral-600">no intent recorded</span>}
        </p>

        <Frame
          step={step}
          annotation={answer ? step.annotation : null}
          maxHeight="58vh"
          onPick={answer ? undefined : submit}
          extra={
            answer ? (
              <>
                <line
                  x1={px(answer.guess).x} y1={px(answer.guess).y}
                  x2={px(target).x} y2={px(target).y}
                  stroke="rgba(255,255,255,.5)" strokeWidth={Math.hypot(step.imageWidth, step.imageHeight) / 500}
                  strokeDasharray="6 6"
                />
                <Marker p={answer.guess} w={step.imageWidth} h={step.imageHeight} color={GUESS} />
                <Marker p={target} w={step.imageWidth} h={step.imageHeight} color={ACCENT} />
              </>
            ) : null
          }
        />

        <div className="mt-4 flex h-10 items-center gap-3 text-sm">
          {answer ? (
            <>
              <span className={answer.hit ? 'text-emerald-400' : 'text-red-400'}>
                {answer.hit ? 'Hit' : 'Miss'}
              </span>
              <span className="text-neutral-500">
                off by {Math.round(answer.distance)}px &middot; within {Math.round(tolerance(step))}px counts
              </span>
              <button
                onClick={() => setI(i + 1)}
                className="rounded bg-amber-500 px-3 py-1.5 font-medium text-neutral-950 hover:bg-amber-400"
              >
                {i === steps.length - 1 ? 'See score' : 'Next'}
              </button>
            </>
          ) : (
            <span className="text-neutral-600">One click on the screenshot.</span>
          )}
        </div>
      </div>
    </div>
  )
}
