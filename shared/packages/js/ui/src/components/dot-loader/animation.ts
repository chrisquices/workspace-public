type Paint = (opacities: readonly string[]) => void
type Subscriber = {
  paint: Paint
  grid: typeof dots
  startAtEdge: boolean
  startTime: number | null
}

const basePeriod = 1.6
const brightness = 0.5
const idleOpacity = 0.025
const brushWidth = 0.385
const trailWidth = 0.935
const brushTilt = 0.3
const vignette = 0.3
const baseSpeed = (1 + brushWidth + trailWidth + brushTilt) / basePeriod
const repeatDistance = 1 + brushTilt
const period = repeatDistance / (baseSpeed * 0.7)
const subscribers = new Map<Element, Subscriber>()
const visible = new Set<Element>()
let observer: IntersectionObserver | null = null
let reducedMotion: MediaQueryList | null = null
let frame: number | null = null
let previous: number | null = null
let elapsedTime = 0

export const dots = Array.from({length: 35 * 35}, function (_, index) {
  const column = index % 35
  const row = Math.floor(index / 35)
  const x = (column - 17) / 17
  const y = (row - 17) / 17
  const radius = Math.hypot(x, y)
  const edge = Math.max(0, Math.min(1, (radius - 0.55) / (Math.SQRT2 - 0.55)))
  return {
    cx: 10 + column * 10,
    cy: 10 + row * 10,
    x: column / 34,
    y: row / 34,
    vignette: 1 - vignette * edge * edge * (3 - 2 * edge),
  }
})

function getPosition(time: number): number {
  return -brushTilt / 2 + (time % period) / period * repeatDistance
}

function getOpacities(time: number, grid = dots, startAtEdge = false): string[] {
  const position = startAtEdge
    ? -brushTilt / 2 - brushWidth + time / period * repeatDistance
    : getPosition(time)

  return grid.map(function (dot) {
    const distance = dot.x - brushTilt * (dot.y - 0.5) - position
    const offset = ((distance % repeatDistance) + repeatDistance) % repeatDistance
    const fade = startAtEdge && distance > 0
      ? Math.min(1, distance / brushWidth)
      : Math.min(1, offset / brushWidth, (repeatDistance - offset) / trailWidth)
    const intensity = 1 - fade * fade * (3 - 2 * fade)
    return (brightness * (idleOpacity + (1 - idleOpacity) * intensity) * dot.vignette).toFixed(3)
  })
}

function paintVisible(): void {
  const frames = new Map<typeof dots, string[]>()
  const staticFrame = reducedMotion?.matches

  for (const element of visible) {
    const subscriber = subscribers.get(element)
    if (!subscriber) continue

    const {grid, paint, startAtEdge} = subscriber
    if (startAtEdge && !staticFrame) {
      subscriber.startTime ??= elapsedTime
      paint(getOpacities(elapsedTime - subscriber.startTime, grid, true))
      continue
    }

    let opacities = frames.get(grid)
    if (!opacities) {
      opacities = getOpacities(staticFrame ? 4 : elapsedTime, grid)
      frames.set(grid, opacities)
    }
    paint(opacities)
  }
}

function tick(time: number): void {
  frame = null

  if (previous === null) previous = time

  const elapsed = time - previous

  if (elapsed >= 1000 / 30) {
    elapsedTime += Math.min(elapsed / 1000, 0.1)
    previous = time
    paintVisible()
  }

  frame = requestAnimationFrame(tick)
}

function sync(): void {
  if (frame !== null) cancelAnimationFrame(frame)

  frame = null
  previous = null

  if (document.hidden || visible.size === 0) return

  paintVisible()

  if (!reducedMotion?.matches) {
    frame = requestAnimationFrame(tick)
  }
}

export function subscribeDotLoader(element: SVGSVGElement, paint: Paint, grid = dots, startAtEdge = false): () => void {
  if (subscribers.size === 0) {
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)

    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(function (entries) {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.add(entry.target)
          } else {
            visible.delete(entry.target)
          }
        }

        sync()
      })
    }
  }

  subscribers.set(element, {paint, grid, startAtEdge, startTime: null})
  const staticFrame = reducedMotion?.matches
  const edgeEntry = startAtEdge && !staticFrame
  const time = staticFrame ? 4 : elapsedTime
  paint(getOpacities(edgeEntry ? 0 : time, grid, edgeEntry))

  if (observer) {
    observer.observe(element)
  } else {
    visible.add(element)
    sync()
  }

  return function () {
    observer?.unobserve(element)
    visible.delete(element)
    subscribers.delete(element)
    sync()

    if (subscribers.size === 0) {
      observer?.disconnect()
      observer = null
      reducedMotion?.removeEventListener('change', sync)
      reducedMotion = null
      document.removeEventListener('visibilitychange', sync)
    }
  }
}
