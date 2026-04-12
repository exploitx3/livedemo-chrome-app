/**
 * Live-demo recording: ghost cursor overlay (DOM, CSS, rAF tick).
 * Pointer position for drawing comes from this module’s own mousemove listener.
 * Cursor path recording for the extension is wired separately in flixHelpers (detectMouseMoveHandler).
 *
 * Lag / tilt / speed thresholds match CoreCursor.js (LAG_THRESH_*, SPEED_EPS, per-frame target delta).
 */

const ROOT_ID = 'ld-recording-tab-cursor-root'
const STYLE_ID = 'ld-recording-tab-cursor-style'
const HTML_CLASS = 'ld-recording-cursor-active'

/** Topmost layer in the tab: browsers cap stacking at 2^31-1 */
const CURSOR_LAYER_Z_INDEX = 2147483647
const MAX_TILT_DEG = 12

const lerp = (a, b, t) => a + (b - a) * t

function normalizeAngleDeg(deg) {
  let d = deg % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

function cursorArrowSvgMarkup(filterId) {
  return `
  <svg class="cursor-arrow-svg" viewBox="258 55 155 245" preserveAspectRatio="xMinYMin meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <filter id="${filterId}" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.45"/>
      </filter>
    </defs>
    <g transform="translate(270, 80)" filter="url(#${filterId})">
      <path d="M 8 0 L 8 180 L 48 138 L 82 210 L 104 200 L 70 128 L 126 128 Z" fill="white" stroke="white" stroke-width="14" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M 8 0 L 8 180 L 48 138 L 82 210 L 104 200 L 70 128 L 126 128 Z" fill="black" stroke="black" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    </g>
  </svg>`
}

function cursorMarkup() {
  return `
<div id="${ROOT_ID}" class="ld-core-cursor-root" aria-hidden="true">
  <div class="cursor-stack cursor-stack--ghost" data-i="2" style="--i:2">${cursorArrowSvgMarkup('ld-rec-cursor-shadow-2')}</div>
  <div class="cursor-stack cursor-stack--ghost" data-i="1" style="--i:1">${cursorArrowSvgMarkup('ld-rec-cursor-shadow-1')}</div>
  <div class="cursor-stack cursor-stack--ghost" data-i="0" style="--i:0">${cursorArrowSvgMarkup('ld-rec-cursor-shadow-0')}</div>
  <div class="cursor-stack cursor-stack--leader">${cursorArrowSvgMarkup('ld-rec-cursor-shadow-l')}</div>
</div>`
}

/** Mirrors CoreCursor Root styled.div — scoped under .ld-core-cursor-root */
function ensureCursorChromeStyle() {
  if (document.getElementById(STYLE_ID)) {
    return
  }
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
html.${HTML_CLASS},
html.${HTML_CLASS} body,
html.${HTML_CLASS} *:not(#${ROOT_ID}),
html.${HTML_CLASS} *:not(#${ROOT_ID})::before,
html.${HTML_CLASS} *:not(#${ROOT_ID})::after,
html.${HTML_CLASS} *:not(#${ROOT_ID})::marker,
html.${HTML_CLASS} ::backdrop,
html.${HTML_CLASS} *::file-selector-button {
  cursor: none !important;
}
#${ROOT_ID},
#${ROOT_ID} *,
#${ROOT_ID} *::before,
#${ROOT_ID} *::after {
  cursor: none !important;
}
html.${HTML_CLASS} ::-webkit-scrollbar,
html.${HTML_CLASS} ::-webkit-scrollbar-thumb,
html.${HTML_CLASS} ::-webkit-scrollbar-track,
html.${HTML_CLASS} ::-webkit-scrollbar-track-piece,
html.${HTML_CLASS} ::-webkit-scrollbar-button,
html.${HTML_CLASS} ::-webkit-resizer {
  cursor: none !important;
}
/* System cursor on iframe chrome; parent doc does not receive mousemove inside OOPIFs, so the ghost cannot track there. */
html.${HTML_CLASS} iframe:not(#${ROOT_ID}) {
  cursor: auto !important;
}
#${ROOT_ID}.ld-core-cursor-root {
  --cursor-w: 40px;
  --cursor-h: calc(var(--cursor-w) * 245 / 155);
  --hotspot-x: calc(var(--cursor-w) * 20 / 155);
  --hotspot-y: calc(var(--cursor-h) * 25 / 245);
  --move-velocity-threshold: 1.5;
  --leader-blur-idle: 0px;
  --leader-blur-moving: 1.205px;
  --ghost-0-opacity-idle: 0.55;
  --ghost-0-blur-idle: 0.4px;
  --ghost-0-opacity-moving: 0.55;
  --ghost-0-blur-moving: 1.2px;
  --ghost-1-opacity-idle: 0.28;
  --ghost-1-blur-idle: 1.4px;
  --ghost-1-filter-opacity-idle: 0.9;
  --ghost-1-opacity-moving: 0.12;
  --ghost-1-blur-moving: 4px;
  --ghost-1-filter-opacity-moving: 0.55;
  --ghost-2-opacity-idle: 0.16;
  --ghost-2-blur-idle: 2.2px;
  --ghost-2-filter-opacity-idle: 0.75;
  --ghost-2-opacity-moving: 0.07;
  --ghost-2-blur-moving: 5.5px;
  --ghost-2-filter-opacity-moving: 0.4;
  --trail-transition-opacity: 0.35s;
  --trail-transition-filter: 0.45s;
  --trail-easing: ease;
  position: fixed;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  z-index: ${CURSOR_LAYER_Z_INDEX} !important;
  isolation: isolate;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.ld-core-cursor-root .cursor-stack {
  position: fixed;
  left: 0;
  top: 0;
  width: var(--cursor-w);
  height: var(--cursor-h);
  pointer-events: none;
  margin-left: calc(-1 * var(--hotspot-x));
  margin-top: calc(-1 * var(--hotspot-y));
  transform-origin: var(--hotspot-x) var(--hotspot-y);
  will-change: transform, opacity, filter;
}
.ld-core-cursor-root .cursor-arrow-svg {
  display: block;
  width: 100%;
  height: 100%;
}
.ld-core-cursor-root .cursor-stack--leader {
  z-index: 500;
  opacity: 1;
  filter: blur(var(--leader-blur-idle));
  transition:
    opacity 0.15s ease,
    filter var(--trail-transition-filter) var(--trail-easing);
}
.ld-core-cursor-root.is-moving.ghosts-visible .cursor-stack--leader {
  filter: blur(var(--leader-blur-moving));
}
.ld-core-cursor-root .cursor-stack--ghost {
  z-index: calc(400 - var(--i, 0));
  transition:
    opacity var(--trail-transition-opacity) var(--trail-easing),
    filter var(--trail-transition-filter) var(--trail-easing);
}
.ld-core-cursor-root:not(.ghosts-visible) .cursor-stack--ghost {
  opacity: 0 !important;
}
.ld-core-cursor-root .cursor-stack--ghost[data-i='0'] {
  opacity: var(--ghost-0-opacity-idle);
  filter: blur(var(--ghost-0-blur-idle));
}
.ld-core-cursor-root .cursor-stack--ghost[data-i='1'] {
  opacity: var(--ghost-1-opacity-idle);
  filter: blur(var(--ghost-1-blur-idle)) opacity(var(--ghost-1-filter-opacity-idle));
}
.ld-core-cursor-root .cursor-stack--ghost[data-i='2'] {
  opacity: var(--ghost-2-opacity-idle);
  filter: blur(var(--ghost-2-blur-idle)) opacity(var(--ghost-2-filter-opacity-idle));
}
.ld-core-cursor-root.is-moving .cursor-stack--ghost[data-i='0'] {
  opacity: var(--ghost-0-opacity-moving);
  filter: blur(var(--ghost-0-blur-moving));
}
.ld-core-cursor-root.is-moving .cursor-stack--ghost[data-i='1'] {
  opacity: var(--ghost-1-opacity-moving);
  filter: blur(var(--ghost-1-blur-moving)) opacity(var(--ghost-1-filter-opacity-moving));
}
.ld-core-cursor-root.is-moving .cursor-stack--ghost[data-i='2'] {
  opacity: var(--ghost-2-opacity-moving);
  filter: blur(var(--ghost-2-blur-moving)) opacity(var(--ghost-2-filter-opacity-moving));
}
`
  document.documentElement.appendChild(style)
}

/**
 * @param {object} flixVars
 */
export function installRecordingTabCursor(flixVars) {
  if (flixVars._recordingTabCursorInstalled) {
    return
  }

  ensureCursorChromeStyle()

  const wrap = document.createElement('div')
  wrap.innerHTML = cursorMarkup().trim()
  const root = wrap.firstElementChild
  document.documentElement.appendChild(root)

  const ghost2 = root.querySelector('.cursor-stack--ghost[data-i="2"]')
  const ghost1 = root.querySelector('.cursor-stack--ghost[data-i="1"]')
  const ghost0 = root.querySelector('.cursor-stack--ghost[data-i="0"]')
  const leader = root.querySelector('.cursor-stack--leader')

  const leaderPos = { x: 0, y: 0 }
  const ghostPos = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]
  let initialized = false
  let tiltRef = 0

  const pointer = { x: 0, y: 0 }
  let hasPointer = false
  const lastTarget = { x: 0, y: 0 }
  let hasLastTarget = false

  const F_LEADER = 0.88
  const F0 = 0.65
  const F1 = 0.55
  const F2 = 0.45
  /** Leader–target gap (px): above this shows ghost layers + trail “moving” styles (`ghosts-visible` / `is-moving`). */
  const LAG_THRESH_GHOST_TRAIL_PX = 0.65

  /** Leader–target gap (px): above this applies movement tilt; at/below eases tilt to 0. */
  const LAG_THRESH_TILT_PX = 0.35
  const DEFAULT_TIP_DEG = -135

  const TILT_LERP = 0.12
  const TILT_RETURN_LERP = 0.18

  const SPEED_EPS = 0.12

  function apply(el, x, y, rotDeg) {
    if (el) el.style.transform = `translate(${x}px, ${y}px) rotate(${rotDeg}deg)`
  }

  function getFrame() {
    if (!hasPointer) return null
    return { target: { x: pointer.x, y: pointer.y }, mode: 'live' }
  }

  let rafId = 0

  function tick() {
    if (!flixVars._recordingTabCursorInstalled) {
      return
    }

    const frame = getFrame()

    if (frame == null) {
      if (root) {
        root.style.opacity = '0'
        root.classList.remove('ghosts-visible', 'is-moving')
      }
      tiltRef = lerp(tiltRef, 0, TILT_RETURN_LERP)
      if (Math.abs(tiltRef) < 0.08) tiltRef = 0
      initialized = false
      hasLastTarget = false
      rafId = requestAnimationFrame(tick)
      flixVars._recordingTabCursorRafId = rafId
      return
    }

    const { target, mode } = frame

    if (root) {
      root.style.opacity = '1'
    }

    if (mode === 'frozen') {
      leaderPos.x = target.x
      leaderPos.y = target.y
      ghostPos[0].x = target.x
      ghostPos[0].y = target.y
      ghostPos[1].x = target.x
      ghostPos[1].y = target.y
      ghostPos[2].x = target.x
      ghostPos[2].y = target.y
      tiltRef = lerp(tiltRef, 0, TILT_RETURN_LERP)
      if (Math.abs(tiltRef) < 0.08) tiltRef = 0
      apply(leader, target.x, target.y, tiltRef)
      apply(ghost0, target.x, target.y, tiltRef)
      apply(ghost1, target.x, target.y, tiltRef)
      apply(ghost2, target.x, target.y, tiltRef)
      if (root) {
        root.classList.remove('ghosts-visible', 'is-moving')
      }
      initialized = true
      rafId = requestAnimationFrame(tick)
      flixVars._recordingTabCursorRafId = rafId
      return
    }

    if (!initialized) {
      leaderPos.x = target.x
      leaderPos.y = target.y
      ghostPos[0].x = target.x
      ghostPos[0].y = target.y
      ghostPos[1].x = target.x
      ghostPos[1].y = target.y
      ghostPos[2].x = target.x
      ghostPos[2].y = target.y
      initialized = true
      lastTarget.x = target.x
      lastTarget.y = target.y
      hasLastTarget = true
      tiltRef = 0
      apply(leader, leaderPos.x, leaderPos.y, 0)
      apply(ghost0, target.x, target.y, 0)
      apply(ghost1, target.x, target.y, 0)
      apply(ghost2, target.x, target.y, 0)
      if (root) {
        root.classList.remove('ghosts-visible', 'is-moving')
      }
      rafId = requestAnimationFrame(tick)
      flixVars._recordingTabCursorRafId = rafId
      return
    }

    let dx = 0
    let dy = 0
    if (hasLastTarget) {
      dx = target.x - lastTarget.x
      dy = target.y - lastTarget.y
    }
    lastTarget.x = target.x
    lastTarget.y = target.y
    hasLastTarget = true

    const stepSpeed = Math.hypot(dx, dy)

    leaderPos.x = lerp(leaderPos.x, target.x, F_LEADER)
    leaderPos.y = lerp(leaderPos.y, target.y, F_LEADER)

    ghostPos[0].x = lerp(ghostPos[0].x, leaderPos.x, F0)
    ghostPos[0].y = lerp(ghostPos[0].y, leaderPos.y, F0)
    ghostPos[1].x = lerp(ghostPos[1].x, ghostPos[0].x, F1)
    ghostPos[1].y = lerp(ghostPos[1].y, ghostPos[0].y, F1)
    ghostPos[2].x = lerp(ghostPos[2].x, ghostPos[1].x, F2)
    ghostPos[2].y = lerp(ghostPos[2].y, ghostPos[1].y, F2)

    const lag = Math.hypot(target.x - leaderPos.x, target.y - leaderPos.y)
    const isGhostTrailMoving = lag > LAG_THRESH_GHOST_TRAIL_PX
    const isTiltTracking = lag > LAG_THRESH_TILT_PX

    let desiredTilt = 0
    if (isTiltTracking && stepSpeed > SPEED_EPS) {
      const movementDeg = (Math.atan2(dy, dx) * 180) / Math.PI
      const delta = normalizeAngleDeg(movementDeg - DEFAULT_TIP_DEG)
      const cap = MAX_TILT_DEG
      desiredTilt = Math.max(-cap, Math.min(cap, delta * 0.28))
    }

    if (isTiltTracking) {
      tiltRef = lerp(tiltRef, desiredTilt, TILT_LERP)
    } else {
      tiltRef = lerp(tiltRef, 0, TILT_RETURN_LERP)
      if (Math.abs(tiltRef) < 0.08) tiltRef = 0
    }

    const rot = tiltRef
    apply(leader, leaderPos.x, leaderPos.y, rot)
    apply(ghost0, ghostPos[0].x, ghostPos[0].y, rot)
    apply(ghost1, ghostPos[1].x, ghostPos[1].y, rot)
    apply(ghost2, ghostPos[2].x, ghostPos[2].y, rot)

    if (root) {
      root.classList.toggle('is-moving', isGhostTrailMoving)
      root.classList.toggle('ghosts-visible', isGhostTrailMoving)
    }

    rafId = requestAnimationFrame(tick)
    flixVars._recordingTabCursorRafId = rafId
  }

  function onMove(e) {
    pointer.x = e.clientX
    pointer.y = e.clientY
    hasPointer = true
  }

  document.documentElement.classList.add(HTML_CLASS)

  document.addEventListener('mousemove', onMove, true)
  flixVars._recordingTabCursorMoveHandler = onMove
  flixVars._recordingTabCursorInstalled = true

  rafId = requestAnimationFrame(tick)
  flixVars._recordingTabCursorRafId = rafId
}

export function removeRecordingTabCursor(flixVars) {
  if (!flixVars._recordingTabCursorInstalled) {
    return
  }

  flixVars._recordingTabCursorInstalled = false

  if (flixVars._recordingTabCursorRafId) {
    cancelAnimationFrame(flixVars._recordingTabCursorRafId)
    flixVars._recordingTabCursorRafId = 0
  }

  const onMove = flixVars._recordingTabCursorMoveHandler
  if (onMove) {
    document.removeEventListener('mousemove', onMove, true)
  }
  delete flixVars._recordingTabCursorMoveHandler

  document.documentElement.classList.remove(HTML_CLASS)

  const root = document.getElementById(ROOT_ID)
  if (root && root.parentNode) {
    root.parentNode.removeChild(root)
  }

  const style = document.getElementById(STYLE_ID)
  if (style && style.parentNode) {
    style.parentNode.removeChild(style)
  }
}
