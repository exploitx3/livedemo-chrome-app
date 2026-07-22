/**
 * Page-world DOM recorder (rrweb 2.1.1).
 * Captures raw events only — click-settle segmentation runs in livedemo-backend
 * processStoryDemoDom. Talks to content script via window.postMessage.
 */
const { record } = require('@rrweb/record')

const CHUNK_SIZE = 512 * 1024
const BATCH_EVENT_COUNT = 200
const MSG_SOURCE = 'livedemo-dom-delta-recorder'

const IncrementalSource = {
  MouseInteraction: 2,
}

const MouseInteractions = {
  Click: 2,
}

// Mirrors chrome-app TagNames used by flix click capture.
const TAG_NAMES = {
  a: 'Link',
  article: 'Article',
  b: 'Text',
  blockquote: 'Quote',
  button: 'Button',
  cite: 'Quote',
  canvas: 'Image',
  code: 'Code',
  form: 'Form',
  h1: 'Title',
  h2: 'Text',
  h3: 'Text',
  h4: 'Text',
  h5: 'Text',
  h6: 'Text',
  img: 'Image',
  svg: 'Image',
  input: 'Input Field',
  label: 'Label',
  li: 'Line Item',
  link: 'Link',
  map: 'Map',
  nav: 'Menu',
  picture: 'Picture',
  progress: 'Progress Bar',
  q: 'Quote',
  table: 'Table',
  title: 'Title',
  video: 'Video',
}

let stopFn = null
let buffer = []
let flushSeq = 0

function postToContent(payload) {
  window.postMessage({ source: MSG_SOURCE, ...payload }, '*')
}

function isClick(event) {
  return (
    event &&
    event.type === 3 &&
    event.data &&
    event.data.source === IncrementalSource.MouseInteraction &&
    event.data.type === MouseInteractions.Click
  )
}

function resolveClickTarget(x, y) {
  if (typeof x !== 'number' || typeof y !== 'number' || typeof document.elementsFromPoint !== 'function') {
    return null
  }
  const stack = document.elementsFromPoint(x, y) || []
  for (let i = 0; i < stack.length; i++) {
    const el = stack[i]
    if (el) {
      return el
    }
  }
  return null
}

function describeClickTarget(target) {
  if (!target || !target.outerHTML) {
    return {
      targetHTML: '',
      targetElementType: '',
      targetText: '',
    }
  }

  let targetHTML = target.outerHTML
  if (targetHTML.length > 1000) {
    targetHTML = targetHTML.slice(0, 1000)
  }

  const tagKey = (target.tagName || '').toLowerCase()
  const targetElementType = TAG_NAMES[tagKey] || ''

  let targetText = ''
  if (targetElementType === TAG_NAMES.img && target.alt) {
    targetText = `"${target.alt}" image`
  } else {
    const text = (target.innerText || '').trim()
    targetText = text ? `"${text}"` : ''
  }

  return { targetHTML, targetElementType, targetText }
}

function sendEventsBatch(events) {
  if (!events || !events.length) {
    return
  }

  const eventsJson = JSON.stringify(events)
  if (eventsJson.length <= CHUNK_SIZE) {
    postToContent({
      type: 'domDelta_eventsBatch',
      events,
    })
    return
  }

  const flushId = `${Date.now()}-${flushSeq++}`
  const totalChunks = Math.ceil(eventsJson.length / CHUNK_SIZE)

  postToContent({
    type: 'domDelta_eventsBatchStart',
    flushId,
    totalChunks,
  })

  for (let i = 0; i < totalChunks; i++) {
    postToContent({
      type: 'domDelta_eventsBatchChunk',
      flushId,
      index: i,
      content: eventsJson.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
    })
  }

  postToContent({
    type: 'domDelta_eventsBatchFinished',
    flushId,
  })
}

function flushBuffer() {
  if (!buffer.length) {
    return
  }
  const events = buffer.splice(0)
  sendEventsBatch(events)
}

function onEmit(event) {
  buffer.push(event)

  if (isClick(event)) {
    const frameX = event.data && typeof event.data.x === 'number' ? event.data.x : 0
    const frameY = event.data && typeof event.data.y === 'number' ? event.data.y : 0
    const target = resolveClickTarget(frameX, frameY)
    const { targetHTML, targetElementType, targetText } = describeClickTarget(target)

    postToContent({
      type: 'domDelta_click',
      timestamp: event.timestamp,
      width: window.innerWidth,
      height: window.innerHeight,
      frameX,
      frameY,
      targetHTML,
      targetElementType,
      targetText,
    })
    // Flush immediately so click (+ preceding events) are uploaded before a
    // navigation can kill the page buffer.
    flushBuffer()
    return
  }

  if (buffer.length >= BATCH_EVENT_COUNT) {
    flushBuffer()
  }
}

/**
 * @param {{ notifyBackground?: boolean }} [options]
 * notifyBackground=false when background already initiated stop (pageStop),
 * so we do not fire a second domDelta_stopRecording / finish.
 * Stop is initiated from the extension popup (same as Manual Recording).
 */
function requestStop(options) {
  const notifyBackground = !(options && options.notifyBackground === false)

  flushBuffer()

  if (typeof stopFn === 'function') {
    try {
      stopFn()
    } catch (e) {
      // ignore
    }
    stopFn = null
  }

  if (notifyBackground) {
    postToContent({ type: 'domDelta_stopRecording' })
  }
}

function startRecording() {
  if (stopFn) {
    return
  }

  buffer = []

  stopFn = record({
    emit: onEmit,
    inlineStylesheet: true,
    collectFonts: true,
    recordCanvas: false,
    recordCrossOriginIframes: false,
    maskAllInputs: false,
    slimDOMOptions: 'all',
  })
}

window.addEventListener('message', (event) => {
  if (!event.data || event.data.source !== 'livedemo-dom-delta-content') {
    return
  }
  if (event.data.type === 'domDelta_pageStart') {
    startRecording()
  }
  if (event.data.type === 'domDelta_pageStop') {
    // Background already owns finish — only stop rrweb locally.
    requestStop({ notifyBackground: false })
  }
})

window.addEventListener('pagehide', () => {
  flushBuffer()
})
window.addEventListener('beforeunload', () => {
  flushBuffer()
})

startRecording()
