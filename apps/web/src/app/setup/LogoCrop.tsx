'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface Crop { x: number; y: number; size: number }

/**
 * Choosing which part of a logo goes in Google's circle.
 *
 * We size a logo automatically and it is right most of the time. What no rule
 * can know is that a brand's round symbol belongs in the circle and its
 * wordmark does not — for a shop whose mark is the recognisable part, the
 * whole logo shrunk to fit is strictly worse than the mark alone.
 *
 * So this is not a step. It is a link under the preview for the owners who
 * care, and the automatic result for everyone else.
 *
 * The circle drawn here is the circle Google draws. Everything outside it is
 * dimmed rather than hidden, so it is obvious what survives and what does
 * not — a crop tool that hides the discarded part leaves people guessing at
 * the very moment they are trying to judge.
 */

const VIEWPORT = 268

export default function LogoCrop(
  { src, initial, onCancel, onSave }: {
    src: string
    initial: Crop | null
    onCancel: () => void
    onSave: (crop: Crop | null) => void
  },
) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  // Offset of the image's top-left corner from the viewport's, in screen px.
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  // The scale at which the image just covers the viewport. Everything else is
  // measured from here, so zoom 1 always means "as small as it can go".
  const base = natural ? Math.max(VIEWPORT / natural.w, VIEWPORT / natural.h) : 1
  const scale = base * zoom

  const clamp = useCallback((o: { x: number; y: number }, s: number) => {
    if (!natural) return o
    const w = natural.w * s
    const h = natural.h * s
    return {
      x: Math.min(0, Math.max(VIEWPORT - w, o.x)),
      y: Math.min(0, Math.max(VIEWPORT - h, o.y)),
    }
  }, [natural])

  function onLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    const n = { w: img.naturalWidth, h: img.naturalHeight }
    setNatural(n)

    const b = Math.max(VIEWPORT / n.w, VIEWPORT / n.h)
    if (initial && initial.size > 0) {
      // Reopen where they left it rather than starting over.
      const s = VIEWPORT / initial.size
      setZoom(s / b)
      setOffset({ x: -initial.x * s, y: -initial.y * s })
    } else {
      setZoom(1)
      setOffset({ x: (VIEWPORT - n.w * b) / 2, y: (VIEWPORT - n.h * b) / 2 })
    }
  }

  function startDrag(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y }
  }
  function moveDrag(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    setOffset(clamp({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) }, scale))
  }
  function endDrag(e: React.PointerEvent) {
    drag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  function changeZoom(next: number) {
    if (!natural) return
    // Zoom about the middle of the viewport, not the image's corner —
    // otherwise what you are looking at slides away as you drag the slider.
    const s0 = base * zoom
    const s1 = base * next
    const cx = VIEWPORT / 2 - offset.x
    const cy = VIEWPORT / 2 - offset.y
    setZoom(next)
    setOffset(clamp({
      x: VIEWPORT / 2 - (cx / s0) * s1,
      y: VIEWPORT / 2 - (cy / s0) * s1,
    }, s1))
  }

  // Escape closes, because a dialog that traps you is worse than no dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function save() {
    if (!natural) return
    onSave({
      x: Math.max(0, Math.round(-offset.x / scale)),
      y: Math.max(0, Math.round(-offset.y / scale)),
      size: Math.round(VIEWPORT / scale),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4
                    sm:items-center"
         role="dialog" aria-modal="true" aria-label="Choose what goes in the circle">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl">
        <p className="text-[15px] font-bold">What goes in the circle?</p>
        <p className="mt-1 text-[12.5px] leading-snug text-muted">
          Google shows your logo as a circle. Drag to move, pinch or use the
          slider to zoom. Only what is inside the circle is kept.
        </p>

        <div
          className="relative mx-auto mt-4 touch-none overflow-hidden rounded-xl bg-white
                     select-none"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src} alt="" onLoad={onLoad} draggable={false}
            className="absolute left-0 top-0 max-w-none origin-top-left"
            style={natural
              ? { width: natural.w * scale, height: natural.h * scale,
                  transform: `translate(${offset.x}px, ${offset.y}px)` }
              : { opacity: 0 }}
          />
          {/* The circle Google draws. Outside is dimmed, not hidden, so it is
              obvious what is being given up. */}
          <div className="pointer-events-none absolute inset-0"
               style={{
                 background: 'rgba(255,255,255,0.72)',
                 WebkitMaskImage:
                   'radial-gradient(circle at 50% 50%, transparent 49.5%, #000 50%)',
                 maskImage:
                   'radial-gradient(circle at 50% 50%, transparent 49.5%, #000 50%)',
               }} />
          <div className="pointer-events-none absolute inset-0 rounded-full
                          ring-1 ring-inset ring-black/15" />
        </div>

        <label className="mt-4 block">
          <span className="text-[12.5px] text-muted">Zoom</span>
          <input type="range" min={1} max={4} step={0.01} value={zoom}
                 onChange={(e) => changeZoom(Number(e.target.value))}
                 className="mt-1 w-full accent-[var(--accent)]" />
        </label>

        <div className="mt-4 flex gap-2">
          <button onClick={save}
            className="flex-1 rounded-xl bg-accent px-4 py-3 text-[14.5px] font-semibold
                       text-accent-ink">
            Use this
          </button>
          <button onClick={onCancel}
            className="rounded-xl border border-line px-4 py-3 text-[14.5px] font-medium">
            Cancel
          </button>
        </div>

        {initial && (
          <button onClick={() => onSave(null)}
            className="mt-3 w-full text-[13px] text-muted hover:text-ink hover:underline">
            Go back to fitting it automatically
          </button>
        )}
      </div>
    </div>
  )
}
