const ENV = require('../../config.json')
const { getImage } = require('./helpers')

const RRWEB_VERSION = '2.1.1'

let session = {
  active: false,
  storyId: null,
  workspaceId: null,
  tabId: null,
  authToken: null,
  demoName: '',
  uploadQueue: Promise.resolve(),
  chunkBuffers: {},
  pendingThumbnails: [],
  viewport: {},
  href: '',
  clickCount: 0,
}

/** In-flight stop guard — popup + page must not finish twice. */
let stopping = false

function resetSession() {
  session = {
    active: false,
    storyId: null,
    workspaceId: null,
    tabId: null,
    authToken: null,
    demoName: '',
    uploadQueue: Promise.resolve(),
    chunkBuffers: {},
    pendingThumbnails: [],
    viewport: {},
    href: '',
    clickCount: 0,
  }
  stopping = false
}

function setClickBadge(count) {
  const text = count > 0 ? String(count) : ''
  chrome.action.setBadgeText({ text })
  if (count > 0) {
    chrome.action.setBadgeTextColor({ color: 'white' })
    chrome.action.setBadgeBackgroundColor({ color: 'red' })
  }
}

function clearClickBadge() {
  chrome.action.setBadgeText({ text: '' })
}

function persistSession() {
  return chrome.storage.local.set({
    domDeltaSession: {
      active: session.active,
      storyId: session.storyId,
      workspaceId: session.workspaceId,
      tabId: session.tabId,
      authToken: session.authToken,
      demoName: session.demoName,
      viewport: session.viewport,
      href: session.href,
      clickCount: session.clickCount || 0,
    },
  })
}

function restoreSession() {
  return chrome.storage.local.get(['domDeltaSession']).then((result) => {
    const saved = result && result.domDeltaSession
    if (saved && saved.active) {
      session.active = saved.active
      session.storyId = saved.storyId
      session.workspaceId = saved.workspaceId
      session.tabId = saved.tabId
      session.authToken = saved.authToken
      session.demoName = saved.demoName
      session.viewport = saved.viewport || {}
      session.href = saved.href || ''
      session.clickCount = saved.clickCount || 0
      session.uploadQueue = Promise.resolve()
      session.chunkBuffers = {}
      session.pendingThumbnails = []
      setClickBadge(session.clickCount)
    }
    return session
  })
}

function enqueueUpload(fn) {
  session.uploadQueue = session.uploadQueue
    .then(() => fn())
    .catch((err) => {
      console.error('domDelta upload failed', err)
    })
  return session.uploadQueue
}

function captureThumbnail() {
  if (session.tabId) {
    return chrome.tabs.get(session.tabId)
      .then((tab) => {
        return new Promise((resolve) => {
          chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png', quality: 50 }, (data) => {
            if (chrome.runtime.lastError) {
              resolve('')
              return
            }
            resolve(data || '')
          })
        })
      })
      .catch(() => '')
  }
  return getImage().catch(() => '')
}

function postJson(urlPath, body) {
  return fetch(`${ENV.STORIES_API}${urlPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.authToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  }).then((res) => {
    if (!res.ok) {
      return res.text().then((t) => {
        throw new Error(`${urlPath} ${res.status}: ${t}`)
      })
    }
    return res.json()
  })
}

function uploadEventsBatch(events, clickThumbnails) {
  if ((!events || !events.length) && (!clickThumbnails || !clickThumbnails.length)) {
    return Promise.resolve()
  }

  return postJson(
    `/workspaces/${session.workspaceId}/stories/${session.storyId}/domRecording/events`,
    {
      events: events || [],
      clickThumbnails: clickThumbnails || [],
      viewport: session.viewport,
      href: session.href,
    }
  )
}

function finishRecording() {
  const thumbs = session.pendingThumbnails.splice(0)
  return postJson(
    `/workspaces/${session.workspaceId}/stories/${session.storyId}/domRecording/finish`,
    {
      events: [],
      clickThumbnails: thumbs,
      viewport: session.viewport,
      href: session.href,
    }
  )
}

function handleEventsBatch(events) {
  return enqueueUpload(() => {
    const thumbs = session.pendingThumbnails.splice(0)
    return uploadEventsBatch(events, thumbs)
  })
}

function handleClick(msg) {
  if (!session.active) {
    return
  }

  // Same as Manual Recording (flix): bump red badge on every click.
  session.clickCount = (session.clickCount || 0) + 1
  setClickBadge(session.clickCount)
  persistSession()

  const timestamp = msg.timestamp
  enqueueUpload(async () => {
    const imageData = await captureThumbnail()
    session.pendingThumbnails.push({
      timestamp,
      imageData: imageData || '',
      frameX: typeof msg.frameX === 'number' ? msg.frameX : 0,
      frameY: typeof msg.frameY === 'number' ? msg.frameY : 0,
      targetText: msg.targetText || '',
      targetHTML: msg.targetHTML || '',
      targetElementType: msg.targetElementType || '',
    })
    if (msg.width && msg.height) {
      session.viewport = {
        width: msg.width,
        height: msg.height,
      }
    }
  })
}

function injectRecorder(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: 'domDelta_inject' }).catch((err) => {
    console.error('domDelta inject failed', err)
  })
}

function createInProgressStory({ name, workspaceId, authToken, href, viewport, tabInfo, windowMeasures }) {
  return fetch(`${ENV.STORIES_API}/inProgressStory`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      name,
      workspaceId,
      recordingType: 'html_delta',
      rrweb: {
        version: RRWEB_VERSION,
        href: href || '',
        viewport: viewport || {},
      },
      tabInfo: tabInfo || {
        width: viewport && viewport.width,
        height: viewport && viewport.height,
      },
      windowMeasures: windowMeasures || {
        innerWidth: viewport && viewport.width,
        innerHeight: viewport && viewport.height,
      },
    }),
  }).then((res) => {
    if (!res.ok) {
      return res.text().then((t) => {
        throw new Error(`inProgressStory ${res.status}: ${t}`)
      })
    }
    return res.json()
  })
}

async function startRecording(msgObj) {
  const authToken = msgObj.authData && msgObj.authData.token
  const demoData = msgObj.demoData || {}
  const workspaceId = demoData.workspaceId
  const name = demoData.demoTitle || demoData.name || 'DOM Demo'
  const tabId = demoData.tabInfo && demoData.tabInfo.id

  if (!authToken || !workspaceId || !tabId) {
    throw new Error('domDelta_startRecording: missing authToken, workspaceId, or tabId')
  }

  const href = (demoData.tabInfo && demoData.tabInfo.url) || ''
  const viewport = demoData.windowMeasures
    ? {
        width: demoData.windowMeasures.innerWidth,
        height: demoData.windowMeasures.innerHeight,
      }
    : {}

  const storyInfo = await createInProgressStory({
    name,
    workspaceId,
    authToken,
    href,
    viewport,
    tabInfo: demoData.tabInfo,
    windowMeasures: demoData.windowMeasures,
  })

  session.active = true
  session.storyId = storyInfo._id
  session.workspaceId = workspaceId
  session.tabId = tabId
  session.authToken = authToken
  session.demoName = name
  session.uploadQueue = Promise.resolve()
  session.chunkBuffers = {}
  session.pendingThumbnails = []
  session.viewport = viewport
  session.href = href
  session.clickCount = 0

  await persistSession()

  chrome.action.setIcon({ path: 'logo-recording-128.png' })
  clearClickBadge()

  await injectRecorder(tabId)

  return { storyId: storyInfo._id }
}

async function stopRecording(options) {
  const fromPage = options && options.fromPage

  if (!session.active) {
    return { success: false, error: 'not recording' }
  }
  if (stopping) {
    return { success: false, error: 'already stopping' }
  }
  stopping = true

  try {
    // Mark inactive immediately so checkRecording / nav reinject stop seeing us
    // as live while finish + preview run.
    session.active = false
    await chrome.storage.local.remove(['domDeltaSession'])

    if (!fromPage && session.tabId) {
      try {
        await chrome.tabs.sendMessage(session.tabId, { type: 'domDelta_requestStop' })
        await new Promise((r) => setTimeout(r, 800))
      } catch (err) {
        console.warn('domDelta page stop message failed', err)
      }
    }

    await session.uploadQueue

    try {
      await finishRecording()
    } catch (err) {
      console.error('Failed to finish dom recording', err)
    }

    const storyId = session.storyId
    const workspaceId = session.workspaceId

    chrome.action.setIcon({ path: 'logo-128.png' })
    clearClickBadge()

    // Mirror Flix: tell an open popup to clear isRecording / saving UI.
    try {
      chrome.runtime.sendMessage({
        name: 'popup_recordingCompleted',
        storyDemo: storyId ? { _id: storyId } : null,
      })
    } catch (e) {
      // Popup may be closed — ignore.
    }

    if (storyId) {
      // Same as regular Flix/AI recording: open public preview, not the editor.
      chrome.tabs.create({
        url: `${ENV.SERVER_URL}/livedemos/${storyId}`,
      })
    }

    resetSession()

    return { success: true, storyId, workspaceId }
  } catch (err) {
    chrome.action.setIcon({ path: 'logo-128.png' })
    clearClickBadge()
    try {
      chrome.runtime.sendMessage({
        name: 'popup_recordingCompleted',
        storyDemo: null,
      })
    } catch (e) {
      // ignore
    }
    await chrome.storage.local.remove(['domDeltaSession']).catch(() => {})
    resetSession()
    throw err
  }
}

function onEventsBatchStart(msg) {
  session.chunkBuffers[msg.flushId] = {
    chunks: [],
    totalChunks: msg.totalChunks,
  }
}

function onEventsBatchChunk(msg) {
  const buf = session.chunkBuffers[msg.flushId]
  if (!buf) {
    return
  }
  buf.chunks[msg.index] = msg.content
}

function onEventsBatchFinished(msg) {
  const buf = session.chunkBuffers[msg.flushId]
  if (!buf) {
    return
  }
  delete session.chunkBuffers[msg.flushId]

  let events
  try {
    events = JSON.parse(buf.chunks.join(''))
  } catch (e) {
    console.error('Failed to reassemble domDelta event chunks', e)
    return
  }

  handleEventsBatch(events)
}

function onNavigationCommitted(details) {
  if (!session.active) {
    return
  }
  if (details.tabId !== session.tabId) {
    return
  }
  if (details.frameId !== 0) {
    return
  }
  if (details.transitionType === 'auto_subframe') {
    return
  }

  const listener = (tabId, changeInfo) => {
    if (tabId === session.tabId && changeInfo.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener)
      injectRecorder(session.tabId)
    }
  }
  chrome.tabs.onUpdated.addListener(listener)
}

function ensureNavigationListener() {
  if (ensureNavigationListener._attached) {
    return
  }
  ensureNavigationListener._attached = true
  chrome.webNavigation.onCommitted.addListener(onNavigationCommitted)
}

ensureNavigationListener()

module.exports = {
  startRecording,
  stopRecording,
  handleEventsBatch,
  handleClick,
  onEventsBatchStart,
  onEventsBatchChunk,
  onEventsBatchFinished,
  restoreSession,
  injectRecorder,
  getSession: () => session,
  isRecording: () => session.active,
}
