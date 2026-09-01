// The file format. Everything here is designed to survive being emailed to a
// stranger and opened on a machine that has never seen the original screen.
//
// All annotation coordinates are PERCENTAGES (0-100) of the natural image
// dimensions, never absolute pixels. That is what lets a step render correctly
// at any display size, and what would let a different machine translate a
// region back into its own screen coordinates.

export type Annotation =
  | { kind: 'arrow'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'badge'; x: number; y: number; n: number }
  | { kind: 'spotlight'; x: number; y: number; w: number; h: number }

export type AnnotationKind = Annotation['kind']

export interface Step {
  id: string
  /** Short, imperative, machine-actionable. "open the Effects panel". */
  intent: string
  /** One or two sentences of human explanation. Optional. */
  note: string
  /** base64 data URL. Embedded, never referenced. */
  image: string
  /** Natural pixel dimensions of `image`, so the file is self-describing. */
  imageWidth: number
  imageHeight: number
  annotation: Annotation | null
}

export interface Walkthrough {
  format: 'clickybench/walkthrough'
  version: 1
  title: string
  createdAt: string
  steps: Step[]
}

export type PlayMode = 'full' | 'speedrun' | 'socratic'

/**
 * The single point a step is "about", in percentage coordinates.
 * Arrow -> its head. Ellipse -> its center. Badge -> its anchor.
 * Spotlight -> the center of the region. Used by Socratic mode to place the
 * rough hint, and by the quiz to score a click.
 */
export function targetOf(a: Annotation): { x: number; y: number } {
  switch (a.kind) {
    case 'arrow': return { x: a.x2, y: a.y2 }
    case 'ellipse': return { x: a.cx, y: a.cy }
    case 'badge': return { x: a.x, y: a.y }
    case 'spotlight': return { x: a.x + a.w / 2, y: a.y + a.h / 2 }
  }
}

export function emptyWalkthrough(): Walkthrough {
  return {
    format: 'clickybench/walkthrough',
    version: 1,
    title: '',
    createdAt: new Date().toISOString(),
    steps: [],
  }
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}
