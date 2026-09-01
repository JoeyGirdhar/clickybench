import { useId, useRef, useState, type ReactNode } from 'react'
import type { Annotation, AnnotationKind, Step } from './types'

export const ACCENT = '#ffb200'
export const GUESS = '#5aa9ff'

/** Percentage point (0-100) relative to natural image dimensions. */
export interface Pt { x: number; y: number }

const clamp = (n: number) => Math.min(100, Math.max(0, n))

function pointFrom(el: HTMLElement, e: { clientX: number; clientY: number }): Pt {
  const r = el.getBoundingClientRect()
  return { x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) }
}

/**
 * Renders an annotation into the image's own coordinate space. The SVG viewBox
 * is the natural image size and percentages are converted at draw time, so the
 * same annotation lands in the same place at any rendered size.
 */
export function AnnotationSvg({
  annotation, w, h, color = ACCENT, extra,
}: { annotation: Annotation | null; w: number; h: number; color?: string; extra?: ReactNode }) {
  const maskId = useId()
  // One unit that scales with the image, so strokes stay proportional.
  const u = Math.hypot(w, h) / 1000
  const px = (n: number) => n * u
  const halo = { filter: `drop-shadow(0 0 ${px(3)}px rgba(0,0,0,.85))` }
  const X = (p: number) => (p / 100) * w
  const Y = (p: number) => (p / 100) * h

  let body: ReactNode = null
  if (annotation?.kind === 'arrow') {
    const [x1, y1, x2, y2] = [X(annotation.x1), Y(annotation.y1), X(annotation.x2), Y(annotation.y2)]
    const ang = Math.atan2(y2 - y1, x2 - x1)
    const head = px(18), half = px(8)
    const bx = x2 - Math.cos(ang) * head, by = y2 - Math.sin(ang) * head
    const nx = -Math.sin(ang) * half, ny = Math.cos(ang) * half
    body = (
      <g style={halo}>
        <line x1={x1} y1={y1} x2={bx} y2={by} stroke={color} strokeWidth={px(5)} strokeLinecap="round" />
        <polygon points={`${x2},${y2} ${bx + nx},${by + ny} ${bx - nx},${by - ny}`} fill={color} />
      </g>
    )
  } else if (annotation?.kind === 'ellipse') {
    body = (
      <ellipse style={halo} cx={X(annotation.cx)} cy={Y(annotation.cy)} rx={X(annotation.rx)} ry={Y(annotation.ry)}
        fill="none" stroke={color} strokeWidth={px(5)} />
    )
  } else if (annotation?.kind === 'badge') {
    const cx = X(annotation.x), cy = Y(annotation.y), r = px(17)
    body = (
      <g style={halo}>
        <circle cx={cx} cy={cy} r={r} fill={color} stroke="rgba(0,0,0,.55)" strokeWidth={px(2)} />
        <text x={cx} y={cy} fill="#151515" fontSize={px(22)} fontWeight="700" textAnchor="middle"
          dominantBaseline="central" fontFamily="ui-sans-serif, system-ui, sans-serif">{annotation.n}</text>
      </g>
    )
  } else if (annotation?.kind === 'spotlight') {
    const [x, y, rw, rh] = [X(annotation.x), Y(annotation.y), X(annotation.w), Y(annotation.h)]
    body = (
      <>
        <mask id={maskId}>
          <rect x={0} y={0} width={w} height={h} fill="white" />
          <rect x={x} y={y} width={rw} height={rh} rx={px(4)} fill="black" />
        </mask>
        <rect x={0} y={0} width={w} height={h} fill="black" opacity={0.6} mask={`url(#${maskId})`} />
        <rect x={x} y={y} width={rw} height={rh} rx={px(4)} fill="none" stroke={color} strokeWidth={px(4)} style={halo} />
      </>
    )
  }

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none" aria-hidden>
      {body}
      {extra}
    </svg>
  )
}

/** Small marker used by the quiz to show a guess or the correct spot. */
export function Marker({ p, w, h, color }: { p: Pt; w: number; h: number; color: string }) {
  const u = Math.hypot(w, h) / 1000
  const [cx, cy] = [(p.x / 100) * w, (p.y / 100) * h]
  return (
    <g style={{ filter: `drop-shadow(0 0 ${3 * u}px rgba(0,0,0,.85))` }}>
      <circle cx={cx} cy={cy} r={10 * u} fill="none" stroke={color} strokeWidth={4 * u} />
      <circle cx={cx} cy={cy} r={2.5 * u} fill={color} />
    </g>
  )
}

/**
 * The screenshot with an overlay locked to it. The wrapper hugs the image
 * exactly, so its bounding rect is the image rect and percentage maths stays
 * honest at any window size.
 */
export function Frame({
  step, annotation, color, extra, tool, onDraw, onPick, badgeNumber, maxHeight = '68vh',
}: {
  step: Step
  annotation: Annotation | null
  color?: string
  extra?: ReactNode
  tool?: AnnotationKind | null
  onDraw?: (a: Annotation) => void
  onPick?: (p: Pt) => void
  badgeNumber?: number
  maxHeight?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<Annotation | null>(null)
  const start = useRef<Pt | null>(null)

  const shape = (a: Pt, b: Pt): Annotation | null => {
    switch (tool) {
      case 'arrow': return { kind: 'arrow', x1: a.x, y1: a.y, x2: b.x, y2: b.y }
      case 'ellipse': return {
        kind: 'ellipse', cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2,
        rx: Math.abs(b.x - a.x) / 2, ry: Math.abs(b.y - a.y) / 2,
      }
      case 'spotlight': return {
        kind: 'spotlight', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
        w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y),
      }
      default: return null
    }
  }

  const sized = (a: Annotation) =>
    a.kind === 'arrow' ? Math.hypot(a.x2 - a.x1, a.y2 - a.y1) > 1
      : a.kind === 'ellipse' ? a.rx + a.ry > 1
        : a.kind === 'spotlight' ? a.w + a.h > 1 : true

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const p = pointFrom(ref.current, e)
    if (onPick) { onPick(p); return }
    if (!tool || !onDraw) return
    if (tool === 'badge') { onDraw({ kind: 'badge', x: p.x, y: p.y, n: badgeNumber ?? 1 }); return }
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = p
    setDraft(shape(p, p))
  }
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current || !ref.current) return
    setDraft(shape(start.current, pointFrom(ref.current, e)))
  }
  const up = () => {
    // Ignore a stray click with no drag, so a mis-click cannot wipe a good
    // annotation with a zero-size one.
    if (start.current && draft && onDraw && sized(draft)) onDraw(draft)
    start.current = null
    setDraft(null)
  }

  const interactive = Boolean(onPick || (tool && onDraw))
  return (
    <div ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      className={`relative inline-block max-w-full touch-none bg-neutral-950 ${interactive ? 'cursor-crosshair' : ''}`}>
      <img src={step.image} alt="" draggable={false} className="block max-w-full object-contain"
        style={{ maxHeight }} />
      <AnnotationSvg annotation={draft ?? annotation} w={step.imageWidth} h={step.imageHeight}
        color={color} extra={extra} />
    </div>
  )
}
