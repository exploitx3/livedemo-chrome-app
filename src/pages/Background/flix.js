import * as EBML from '../../modules/ts-ebml/dist/EBML'

const ENV = require('../../config.json')

const MESSAGE_NAMES = {
    VideoResults: 'ld-video-results',
    TabInfo: 'ld-tab-info',
    StartAIRecording: 'ld-start-ai-recording',
    StartRecording: 'ld-start-recording',
    StopRecording: 'ld-stop-recording',
    StopAIRecording: 'ld-stop-ai-recording',
    SendStream: 'ld-send-stream',
    AddEventListeners: 'ld-add-event-listeners',
    RemoveEventListeners: 'ld-remove-event-listeners',
    FrameInfoReport: 'ld-frame-info-report',
    Click: 'ld-click-event',
    CursorMove: 'ld-cursor-move',
    Scroll: 'ld-scroll-event',
    KeyPress: 'ld-keypress-event',
    ScreenshotRequest: 'ld-screenshot-request',
    DoneTakingScreenshot: 'ld-done-taking-screenshot',
    PrepareToForwardRecordingData: 'ld-prepare-to-forward-recording-data',
    ForwardRecordingData: 'ld-forward-recording-data',
    ShowRecordingCountdown: 'ld-show-recording-countdown',
    CancelRecordingCountdown: 'ld-cancel-recording-countdown',
}

const MESSAGE_NAMES_VALUES = Object.values(MESSAGE_NAMES)

const millisecondsPerBlob = 100

/** Survives flixVars ← storage merges (functions are not persisted). Used to remove the real listener on stop. */
let activeRecordingMessageListener = null

/**
 * Heavy/in-memory-only fields that must never hit chrome.storage.local:
 * screenshots and cursor arrays can be tens of MB and were being re-serialized
 * on every cursor move, and storage.local is quota-capped (~10MB).
 */
const NON_PERSISTED_FLIX_KEYS = [
    'screenshots',
    'currentScreenshotDataUrl',
    'cursorPositions',
    'videoBlobs',
    'videoBlobsUrl',
    'videoStream',
    'videoRecorder',
    'messageListenerHandler',
    'screenshotTimer',
]

function persistLightFlixVars(flixVars) {
    const light = { ...flixVars }
    NON_PERSISTED_FLIX_KEYS.forEach((key) => {
        delete light[key]
    })
    return chrome.storage.local.set(light)
}

function registerRecordingMessageListener(flixVars, handler) {
    if (activeRecordingMessageListener) {
        chrome.runtime.onMessage.removeListener(activeRecordingMessageListener)
    }
    activeRecordingMessageListener = handler
    flixVars.messageListenerHandler = handler
    chrome.runtime.onMessage.addListener(handler)
}

function clearRecordingMessageListener() {
    if (activeRecordingMessageListener) {
        chrome.runtime.onMessage.removeListener(activeRecordingMessageListener)
        activeRecordingMessageListener = null
    }
}

function clearCursorPositions(flixVars) {
    flixVars.cursorPositions = []
}

function clearRecordingBadge() {
    chrome.action.setBadgeText({ text: '' })
}

function resetVars(flixVars) {
    console.log('resetting flixVars')
    clearRecordingBadge()


    flixVars.autoRecordingId = undefined

    flixVars.demoTitle = ''
    flixVars.capturedEvents = []
    clearCursorPositions(flixVars)
    flixVars.demoClickCount = 0
    flixVars.lastDemoEvent = undefined
    flixVars.demoData = {}

    flixVars.videoTabId = 0
    flixVars.videoRecorder = undefined
    flixVars.videoBlobs = []

    flixVars.videoBlobsUrl = ''
    flixVars.videoStartMs = 0
    flixVars.videoEndMs = 0

    flixVars.recording = false
    flixVars.IsAttached = false
    flixVars.stopInProgress = false

    flixVars.currentScreenshotDataUrl = ''
    flixVars.screenshots = {}

    return chrome.storage.local.get(null)
        .then((storage) => {
            const screenshotKeys = Object.keys(storage).filter((key) => key.startsWith('screenshot_'))
            if (screenshotKeys.length) {
                return chrome.storage.local.remove(screenshotKeys)
            }
        })
        .then(() => persistLightFlixVars(flixVars))

}

async function mergeScreenshotsFromStorage(inMemoryScreenshots) {
    const storage = await chrome.storage.local.get(null)
    const fromStorage = {}

    Object.entries(storage).forEach(([key, value]) => {
        if (key.startsWith('screenshot_')) {
            fromStorage[key.slice('screenshot_'.length)] = value
        }
    })

    return { ...fromStorage, ...inMemoryScreenshots }
}

function resumeRecordingAfterSwRestart(flixVars) {
    registerRecordingMessageListener(flixVars, listenerClosure(flixVars))
    startTakingScreenshots(flixVars)
}

function listenerClosure(flixVars) {


    return async function (message, sender, sendResponse) {
        // console.log('internal event listener for click:')
        // console.log(message)
        // console.log(flixVars)

        switch (message.name) {
            // case MESSAGE_NAMES.FrameInfoReport:
            //   this.onFrameInfoReport(message, sender)
            //   break
            case MESSAGE_NAMES.Click:
                await onClick(flixVars, message, sender)
                break
            case MESSAGE_NAMES.CursorMove:
                onInterestingEvent(flixVars, message, sender)
                break
            case MESSAGE_NAMES.Scroll:
                onInterestingEvent(flixVars, message, sender)
                break
            case MESSAGE_NAMES.KeyPress:
                onInterestingEvent(flixVars, message, sender)
                break

        }


        return true
    }
}


function startAIRecording(flixVars) {

    console.log("startAIRecording called final")

    clearCursorPositions(flixVars)
    flixVars.demoClickCount = 0
    clearRecordingBadge()

    registerRecordingMessageListener(flixVars, listenerClosure(flixVars))
    startTakingScreenshots(flixVars)
    return Promise.resolve()
}

async function stopAIRecording(flixVars, autoRecordingId) {

    console.log("stopAIRecording called final")

    let { clickId, imageData } = await takeNSaveScreenshot('final', flixVars)
    let timeMs = Date.now();

    debugger
    await sendAutoRecordingEvent({
        type: 'final-screenshot',
        clickId,
        timeMs,
        imageData
    }, flixVars.autoRecordingId, flixVars.demoData.workspaceId)
    // Upload screenshot as event

    console.log('took final screenshot')
    // Send finalize API call
    debugger
    let authToken = flixVars && flixVars.authData && flixVars.authData.token
    await completeAutoRecording(flixVars.autoRecordingId, flixVars.demoData.workspaceId, authToken)

}


function completeAutoRecording(autoRecordingId, workspaceId, authToken) {

    return fetch(`${ENV.STORIES_API}/workspaces/${workspaceId}/auto-recordings/${autoRecordingId}/complete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({})
    })
        .then(res => res.json())
        .then(data => {
            return data
        })
}

function start(flixVars) {

    clearCursorPositions(flixVars)
    flixVars.demoClickCount = 0
    clearRecordingBadge()

    registerRecordingMessageListener(flixVars, listenerClosure(flixVars))
    startTakingScreenshots(flixVars)

    return startRecordingLiveDemoWithHelperTab(flixVars)

}

function stop(flixVars, storage) {
    console.log('[LD:bg:flix] stop:', { type: flixVars.type })

    clearRecordingMessageListener()

    // Flix live demo + plain tab video: helper tab records; same STOP_RECORDING path.
    if (flixVars.type === 'FlixDemo' || flixVars.type === 'Video') {
        stopTakingScreenshots(flixVars)
        console.log('[LD:bg:flix] stop: calling stopRecordingVideo', { helperTabId: storage && storage.helperTabId })
        return stopRecordingVideo(storage)
    }

    if (flixVars.type === 'AIDemo') {
        stopTakingScreenshots(flixVars)
        return stopAIRecording(flixVars, storage.autoRecordingId)
            .then(() => {
                clearCursorPositions(flixVars)
            })
    }

    stopTakingScreenshots(flixVars)
    return Promise.resolve()
}

async function onClick(flixVars, message, sender) {

    if (sender.tab === undefined || sender.tab.id === undefined) {
        console.log('Malformed message', { message, sender })
        return
    }
    const tabId = sender.tab.id
    const frameId = sender.frameId ?? 0

    const { clickId, frameX, frameY, timeMs, targetElementType, targetHTML, targetText } = message

    if (flixVars.currentScreenshotDataUrl) {


        saveScreenshot(flixVars, clickId, flixVars.currentScreenshotDataUrl)

        // console.log('onClick:')
        // console.log(flixVars)

        const event = {
            type: 'click',
            clickId,
            frameX,
            frameY,
            timeMs,
            tabId,
            frameId,
            targetElementType,
            targetHTML,
            targetText
        }

        flixVars.capturedEvents.push(event)
        flixVars.lastDemoEvent = event
        console.log(event)

        flixVars.demoClickCount++

        chrome.action.setBadgeText({ text: flixVars.demoClickCount.toString() });
        chrome.action.setBadgeTextColor({ color: "white"});
        chrome.action.setBadgeBackgroundColor(
            { color: 'red' }
        )   

        persistLightFlixVars(flixVars)

        if (flixVars.type === 'AIDemo') {
            debugger
            // AI auto-recording: upload the click event with the screenshot as event
            await sendAutoRecordingEvent({
                ...event,
                imageData: flixVars.currentScreenshotDataUrl
            }, flixVars.autoRecordingId, flixVars.demoData.workspaceId)

            if (flixVars.demoClickCount >= ENV.CLICK_LIMIT_FOR_AI_RECORDING) {
                console.log(`flixVars.demoClickCount >= ${ENV.CLICK_LIMIT_FOR_AI_RECORDING} stopping recording`)
                chrome.action.openPopup();
                chrome.action.setBadgeText({ text: '' });

                // await flix_stopRecording(flixVars, flixVars, () => { })
            }

        }

        // this.setBadge(this.demoClickCount)

    } else {
        console.log('Click happened, but no screenshot had been captured yet')
    }
}

function flix_stopRecording(flixVars, flixVarsGlobal, sendCommandResp) {
    console.log('[LD:bg:flix] flix_stopRecording: start')
    // Snapshot then hard-clear so resume path cannot false-positive if later steps fail
    return chrome.storage.local.get(null)
        .then((storage) => {
            const wasRecording = !!storage.recording
            const stopType = storage.type ?? flixVars.type
            console.log('[LD:bg:flix] flix_stopRecording: storage read', {
                wasRecording,
                stopType,
                IsAttached: storage.IsAttached,
                helperTabId: storage.helperTabId,
            })
            flixVars.recording = false
            return chrome.storage.local.set({ stopInProgress: true, recording: false })
                .then(() => ({ storage, wasRecording, stopType }))
        })
        .then(({ storage, wasRecording, stopType }) => {
            if (!wasRecording && stopType !== 'FlixDemo' && stopType !== 'Video') {

                console.log('[LD:bg:flix] flix_stopRecording: not recording — early exit')
                clearRecordingBadge()
                return chrome.storage.local.set({
                    stopInProgress: false,
                    IsAttached: false,
                    recording: false,
                }).then(() => {
                    chrome.runtime.sendMessage({
                        name: 'popup_recordingCompleted',
                        storyDemo: { _id: '' }
                    }, () => void chrome.runtime.lastError)

                    console.log('flix_stopRecording: not recording, sending success')
                    sendCommandResp({
                        success: true
                    })
                })
            }
            // flixVars = storage.flixVars


            flixVars.IsAttached = false

            console.log('[LD:bg:flix] flix_stopRecording: stopping', { stopType })

            // Heavy fields (screenshots, cursorPositions) live only in memory now,
            // so merge storage over the in-memory vars instead of replacing them.
            flixVars = { ...flixVars, ...storage, recording: false }

            chrome.action.setBadgeText({ text: '' });

            const recordType = flixVars.type

            if (recordType === 'FlixDemo' || recordType === 'Video') {

                stopRecordingDemoFromBackground(flixVars, storage)
                    .then(() => {
                        console.log('[LD:bg:flix] flix_stopRecording: stopRecordingDemoFromBackground ok')
                        sendCommandResp({
                            success: true
                        })
                    })
                    .catch((err) => {
                        console.error('[LD:bg:flix] flix_stopRecording: Flix/Video failed', err)
                        clearRecordingBadge()
                        flixVars.recording = false
                        flixVars.stopInProgress = false
                        return chrome.storage.local.set({
                            recording: false,
                            stopInProgress: false,
                            IsAttached: false,
                        }).then(() => {
                            sendCommandResp({ success: false, error: err && err.message ? err.message : String(err) })
                        })
                    })
            } else if (recordType === 'AIDemo') {

                stopRecordingDemoFromBackground(flixVars, storage)
                    .then(() => {

                        return stopAndOpenAutoRecording(flixVars, flixVarsGlobal, sendCommandResp)
                            .then(() => {

                                sendCommandResp({
                                    success: true
                                })
                            })
                    })
                    .catch((err) => {
                        console.error('flix_stopRecording AIDemo', err)
                        clearRecordingBadge()
                        flixVars.recording = false
                        return chrome.storage.local.set({ recording: false }).then(() => {
                            sendCommandResp({ success: false, error: err && err.message ? err.message : String(err) })
                        })
                    })

            } else {

                console.warn('flix_stopRecording: unknown type, running demo stop only', recordType)
                stopRecordingDemoFromBackground(flixVars, storage)
                    .then(() => {

                        sendCommandResp({
                            success: true
                        })
                    })
                    .catch((err) => {
                        console.error('flix_stopRecording fallback', err)
                        clearRecordingBadge()
                        sendCommandResp({ success: false, error: err && err.message ? err.message : String(err) })
                    })
            }
        })
}


function stopAndOpenAutoRecording(flixVars, flixVarsGlobal, sendCommandResp) {

    return new Promise((resolve, reject) => {


        chrome.runtime.sendMessage({
            name: 'popup_recordingCompleted',
            storyDemo: { _id: '' }
        }, () => void chrome.runtime.lastError)

        return resetVars(flixVars)
            .then(() => {

                return chrome.storage.local.get(null)
                    .then((storageVars) => {
                        flixVars = { ...flixVarsGlobal, ...storageVars }
                    })
            })
            .then(() => {

                let promiseChain = Promise.resolve()
                if (flixVars.autoRecordingId) {
                    promiseChain = new Promise((resolveChain, rejectChain) => {
                        chrome.tabs.create({ 'url': `${ENV.SERVER_URL}/auto-recordings/${flixVars.autoRecordingId}` }, function () {
                            resolveChain()
                        })
                    })
                }

                return promiseChain
            })
            .then(() => {
                resolve()
            })


    })
}


function sendAutoRecordingEvent(event, autoRecordingId, workspaceId) {
    return fetch(`${ENV.STORIES_API}/workspaces/${workspaceId}/auto-recordings/${autoRecordingId}/events`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            events: [event]
        })
    })
        .then(res => res)
}


function onInterestingEvent(flixVars, message, sender) {

    if (sender.tab === undefined || sender.tab.id === undefined) {
        log('Malformed message', { message, sender })
        return
    }
    const tabId = sender.tab.id
    const frameId = sender.frameId ?? 0

    // Ignore events from all tabs other than the one we're recording video of
    // if (tabId !== this.videoTabId) {
    //   return
    // }

    if (message.name === MESSAGE_NAMES.CursorMove) {
        const { timeMs, frameX, frameY } = message
        const point = {
            frameX,
            frameY,
            timeMs,
        }
        if (!Array.isArray(flixVars.cursorPositions)) {
            flixVars.cursorPositions = []
        }
        // In-memory only: persisting on every mousemove serialized the whole
        // flixVars object (screenshots included) many times per second.
        flixVars.cursorPositions.push(point)
        return
    }

    let type = ''
    switch (message.name) {
        case MESSAGE_NAMES.KeyPress:
            type = 'typing'
            break
        case MESSAGE_NAMES.Scroll:
            type = 'scrolling'
            break
    }

    const { timeMs } = message
    if (flixVars.lastDemoEvent?.type === type) {

        flixVars.lastDemoEvent.endTimeMs = timeMs
    } else {

        const event = {
            type,
            startTimeMs: timeMs,
            endTimeMs: timeMs,
            tabId,
            frameId,
        }

        flixVars.capturedEvents.push(event)
        flixVars.lastDemoEvent = event

        persistLightFlixVars(flixVars)

    }
}

function startTakingScreenshots(flixVars) {
    flixVars.isTakingScreenshots = true
    flixVars.currentScreenshotDataUrl = ''
    flixVars.screenshotTimer = setInterval(() => {
        takeScreenshot(flixVars)
    }, 550)
}

function isCapturableTabUrl(url) {
    if (!url) {
        return false
    }
    const base = url.split(/[?#]/)[0]
    return base.startsWith('http://') || base.startsWith('https://') || base.startsWith('file://')
}

function getRecordedTabId(flixVars) {
    return flixVars.demoData?.tabInfo?.id
        ?? flixVars.demoData?.tabInfo?.tabId
        ?? flixVars.videoTabId
        ?? 0
}

// Capture from the recorded tab's window — not getLastFocused (popup/chrome:// breaks stop).
function captureScreenshotForRecording(flixVars) {
    return new Promise((resolve) => {
        const finish = (image) => resolve(image || '')

        const captureInWindow = (windowId) => {
            chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (image) => {
                void chrome.runtime.lastError
                finish(image)
            })
        }

        const tabId = getRecordedTabId(flixVars)
        if (!tabId) {
            chrome.windows.getLastFocused()
                .then((window) => captureInWindow(window.id))
                .catch(() => finish(''))
            return
        }

        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
                finish('')
                return
            }
            if (!isCapturableTabUrl(tab.url)) {
                finish('')
                return
            }
            captureInWindow(tab.windowId)
        })
    })
}

function takeScreenshot(flixVars) {
    return captureScreenshotForRecording(flixVars)
        .then((image) => {
            if (image) {
                flixVars.currentScreenshotDataUrl = image
            }
        })
        .catch(() => {})
}


function takeNSaveScreenshot(clickId, flixVars) {
    return new Promise((resolve) => {

        setTimeout(() => {
            captureScreenshotForRecording(flixVars)
                .then((image) => {
                    if (image) {
                        flixVars.currentScreenshotDataUrl = image
                    }
                    const imageData = flixVars.currentScreenshotDataUrl || ''
                    saveScreenshot(flixVars, clickId, imageData)
                    resolve({ imageData, clickId })
                })
                .catch(() => {
                    const imageData = flixVars.currentScreenshotDataUrl || ''
                    saveScreenshot(flixVars, clickId, imageData)
                    resolve({ imageData, clickId })
                })
        }, 550)


    })

}

function stopTakingScreenshots(flixVars) {

    if (flixVars.screenshotTimer) {
        clearInterval(flixVars.screenshotTimer)
        flixVars.screenshotTimer = null
    }

    flixVars.isTakingScreenshots = false
}


function getCurrentTab() {

    return new Promise(resolve => {
        chrome.tabs.query(
            {
                active: true,
                // currentWindow: true,
                lastFocusedWindow: true,
            },
            async ([tab]) => {
                if (tab) {
                    resolve(tab)
                } else {
                    resolve(null)
                }
            }
        )
    })
}

async function getCurrentTabInfo() {
    const tab = await getCurrentTab()
    if (tab) {
        return {
            title: tab.title || '',
            url: tab.url || '',
            width: tab.width,
            height: tab.height,
            tabId: tab.id ?? 0,
        }
    } else {
        console.log('Error: Could not get tab info in getCurrentTabInfo', tab)
        return { title: '', url: '', width: 0, height: 0, tabId: 0 }
    }
}

function loadImage(src) {

    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = (...args) => reject(args)
        img.src = src
    })
}

async function analyzeImage(dataUrl) {
    // Load the data URL as an image element
    const image = await loadImage(dataUrl)

    return {
        aspectRatio: image.height / image.width,
    }
}

function saveScreenshot(flixVars, clickId, dataUrl) {


    flixVars.screenshots[clickId] = dataUrl
    chrome.storage.local.set({ ['screenshot_' + clickId]: dataUrl })

    // flixVars.screenshots[clickId] = window.URL.createObjectURL(new Blob([dataUrl]))

    // flixVars.screenshots[clickId] = analyzeImage(dataUrl).then(
    //   ({ aspectRatio }) => {
    //
    //     flixVars.aspectRatio = aspectRatio
    //     return {
    //       dataUrl
    //     }
    //   })
}


/**
 * Single-pass replacement for the old addColorMetadataForVP9 + getSeekableBlob
 * chain: one ArrayBuffer read, one decode, one output Blob. Inserts the VP9
 * Colour tag into the parsed metadata, then rebuilds it as seekable metadata
 * (Duration + SeekHead + Cues) in the same operation.
 */
async function finalizeWebmBlob(inputBlob) {
    const buffer = await inputBlob.arrayBuffer()

    const reader = new EBML.Reader()
    const decoder = new EBML.Decoder()
    const tools = EBML.tools

    decoder.decode(buffer).forEach(element => {
        reader.read(element)
    })
    reader.stop()

    tools.insertTag(reader.metadatas, 'Video', [
        { name: 'Colour', type: 'm', isEnd: false },
        {
            name: 'TransferCharacteristics',
            type: 'u',
            data: tools.createUIntBuffer(1),
        },
        {
            name: 'MatrixCoefficients',
            type: 'u',
            data: tools.createUIntBuffer(1),
        },
        { name: 'Primaries', type: 'u', data: tools.createUIntBuffer(1) },
        { name: 'Range', type: 'u', data: tools.createUIntBuffer(1) },
        { name: 'Colour', type: 'm', isEnd: true },
    ])

    const newMetadataBuffer = tools.makeMetadataSeekable(
        reader.metadatas,
        reader.duration,
        reader.cues
    )

    const body = buffer.slice(reader.metadataSize)
    return new Blob([newMetadataBuffer, body], {
        type: 'video/webm',
    })
}

function resolveAllFields(promises) {
    const promisesArray = Object.entries(promises).map(([key, promise]) => {

        return promise.then(result => [key, result])
    })

    return Promise.all(promisesArray).then(Object.fromEntries)
}

function resolveAllScreenshotFields(blobs) {
    let promiseChain = Promise.resolve()
    let screenshotObj = {}

    Object.entries(blobs).map(([key, blobUrl]) => {

        promiseChain = promiseChain.then(() => {

            return getBlobFromUrl(blobUrl)
        })
            .then((blob) => {
                screenshotObj[key] = screenshotObj
            })
    })

    promiseChain.then(() => screenshotObj)

    return promiseChain
}

function getBlobFromUrl(url) {
    console.log('Fetch url - ' + url)
    return fetch(url, {
        method: 'GET',
    })
        .then((response) => {
            console.log(response)

            return response.blob()
        })
}

function blobToBase64(blob) {

    return new Promise((resolve, reject) => {

        const reader = new FileReader()

        reader.addEventListener('load', () => {
            resolve(reader.result)
        }, false)

        reader.readAsDataURL(blob)
    })

}

async function uploadVideo(videoBlob, workspaceId, flixVars) {

    const videoBlobWithMetadata = await finalizeWebmBlob(videoBlob)

    const videoBase64 = await blobToBase64(videoBlobWithMetadata)

    const payload = {
        base64Video: videoBase64,
    }

    if (flixVars.demoData && flixVars.demoData.storyId) {
        payload.storyId = flixVars.demoData.storyId
    }

    return await fetch(`${ENV.STORIES_API}/workspaces/${workspaceId}/library/uploadVideo`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${flixVars && flixVars.authData && flixVars.authData.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(payload)
    })
        .then(res => {
            return res.json()
        })
        .then((data) => {
            // Release references to the video copies as soon as upload finishes.
            flixVars.videoBlobs = null
            flixVars.videoBlobsUrl = ''
            clearCursorPositions(flixVars)
            return data
        })
    //send payload to server
}

async function afterRecordingVideo(flixVars) {

    console.log('[LD:bg:flix] afterRecordingVideo: start', {
        hasVideoBlob: !!(flixVars.videoBlobs && flixVars.videoBlobs.size),
        hasDemoData: !!flixVars.demoData,
        demoTitle: flixVars.demoData && flixVars.demoData.demoTitle,
    })

    await takeNSaveScreenshot('final', flixVars)

    console.log('[LD:bg:flix] afterRecordingVideo: final screenshot done')

    const videoBlob = flixVars.videoBlobs

    console.log('[LD:bg:flix] afterRecordingVideo: finalizeWebmBlob start')
    const videoBlobWithMetadata = await finalizeWebmBlob(videoBlob)
    console.log('[LD:bg:flix] afterRecordingVideo: finalizeWebmBlob done')

    const videoBase64 = await blobToBase64(videoBlobWithMetadata)
    console.log('[LD:bg:flix] afterRecordingVideo: video base64 ready', {
        length: videoBase64 && videoBase64.length,
    })

    // Release the raw video copies; only videoBase64 is needed from here on.
    flixVars.videoBlobs = null
    flixVars.videoBlobsUrl = ''

    const screenshots = await mergeScreenshotsFromStorage(flixVars.screenshots)
    console.log('[LD:bg:flix] afterRecordingVideo: screenshots merged', {
        count: Object.keys(screenshots).length,
    })

    console.log('[LD:bg:flix] afterRecordingVideo: POST inProgressStory')
    return await fetch(`${ENV.STORIES_API}/inProgressStory`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${flixVars && flixVars.authData && flixVars.authData.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            name: flixVars.demoData.demoTitle,
            workspaceId: flixVars.demoData.workspaceId
        })
    })
        .then(res => {
            if (!res.ok) {
                throw new Error(`inProgressStory failed: ${res.status}`)
            }
            return res.json();
        })
        .then((storyInfo) => {


            const payload = {
                // videoBlobUrl,
                storyId: storyInfo._id,
                name: flixVars.demoData.demoTitle,
                shortId: flixVars.demoData.shortId,
                tabInfo: flixVars.demoData.tabInfo,
                windowMeasures: flixVars.demoData.windowMeasures ? flixVars.demoData.windowMeasures : {},
                workspaceId: flixVars.demoData.workspaceId,
                capturedEvents: flixVars.capturedEvents,
                cursorPositions: Array.isArray(flixVars.cursorPositions) ? flixVars.cursorPositions : [],
                videoBase64: videoBase64,
                screenshots,
                videoStartMs: flixVars.videoStartMs,
                videoEndMs: flixVars.videoEndMs,
                aspectRatio: flixVars.aspectRatio,
            }

            const payloadJson = JSON.stringify(payload)

            clearCursorPositions(flixVars)

            console.log('[LD:bg:flix] afterRecordingVideo: payload ready', {
                storyId: storyInfo._id,
                payloadJsonLength: payloadJson.length,
            })

            return {
                payload,
                payloadJson,
                newStoryId: storyInfo._id
            }
        })
    //send payload to server
}



function processStream(flixVars, stream) {

    if (!stream) {
        return
    }
    flixVars.videoStream = stream
    flixVars.videoTabId = tabInfo.tabId

    flixVars.videoRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        audioBitsPerSecond: 0,
    })

    flixVars.videoBlobs = []
    flixVars.videoRecorder.ondataavailable = function (event) {
        console.log('data-available', event.data.size)

        if (event.data && event.data.size > 0) {
            flixVars.videoBlobs?.push(event.data)
        }
    }

    this.videoRecorder.onstop = function () {
        afterRecordingVideo(flixVars)
        stream.getTracks().forEach(track => track.stop())
    }

    stream.getVideoTracks()[0].onended = () => {

        if (flixVars.videoRecorder && flixVars.videoRecorder.state !== 'inactive') {
            flixVars.videoRecorder.stop()
        }
    }

    flixVars.videoRecorder.start(millisecondsPerBlob)
    flixVars.videoStartMs = Date.now()
}

function sleep(ms = 0) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function setStorage(key, value) {
    return new Promise((resolve) => {
        chrome.storage.local.set(
            {
                [key]: value,
            },
            () => {
                if (chrome.runtime.lastError) {
                    console.log('Error setting')
                    console.log(chrome.runtime.lastError)
                }

                resolve(value)
            }
        )
    })
}

function openHelperTab() {
    return new Promise(async (resolve) => {
        chrome.windows.getLastFocused().then((currentWindow) => {

            chrome.tabs.create(
                {
                    pinned: true,
                    active: false, // <--- Important
                    url: `chrome-extension://${chrome.runtime.id}/helperTab.html`,
                    windowId: currentWindow.id
                },
                (tab) => {
                    resolve({
                        tab: tab,
                        window: currentWindow
                    })
                }
            )
        })
    })
}

function sendMessageToTab(tabId, data) {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, data, (res) => {
            if (chrome.runtime.lastError) {
                console.log(chrome.runtime.lastError)
            }

            resolve(res)
        })
    })
}


async function startRecordingLiveDemoWithHelperTab(flixVars) {

    flixVars.isRecordingVideo = true

    let currentTab = await getCurrentTabInfo()


    let { tab, window } = await openHelperTab()
    let helperTab = tab

    await setStorage('helperTabId', helperTab.id)
    await setStorage('helperWindowId', window.id)

    await sleep(500)

    let response = await sendMessageToTab(helperTab.id, {
        name: 'START_RECORDING',
        data: {
            currentTabId: currentTab.id,
            tabInfo: currentTab
        },
    })

    if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError)
    }

    console.log(response)

    return helperTab
}

async function startRecordingVideoWithHelperTab(flixVars) {

    flixVars.isRecordingVideo = true

    let currentTab = await getCurrentTabInfo()
    if (currentTab.tabId) {
        flixVars.tabId = currentTab.tabId
    }

    let { tab, window } = await openHelperTab()
    let helperTab = tab

    await setStorage('helperTabId', helperTab.id)
    await setStorage('helperWindowId', window.id)

    await sleep(500)

    let response = await sendMessageToTab(helperTab.id, {
        name: 'START_VIDEO_RECORDING',
        data: {
            currentTabId: currentTab.tabId,
            tabInfo: currentTab
        },
    })

    if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError)
    }

    console.log(response)

    if (currentTab.tabId) {
        await sendMessageToTab(currentTab.tabId, {
            name: MESSAGE_NAMES.AddEventListeners,
        })
    }

    return { helperTab, window }
}

function startRecordingVideoWithTab(flixVars) {

    flixVars.isRecordingVideo = true


    return new Promise((resolve, reject) => {

        getCurrentTabInfo().then(tabInfo => {

            console.log(tabInfo)

            flixVars.videoTabId = tabInfo.tabId

            chrome.tabs.sendMessage(flixVars.tabId, {
                name: MESSAGE_NAMES.TabInfo,
                tabInfo: tabInfo
            }, {}, function () {

                chrome.tabs.sendMessage(flixVars.tabId, {
                    name: MESSAGE_NAMES.StartRecording,
                }, {}, function (response) {

                    if (response.videoStartMs) {
                        console.log('got videoStartMs from StartRecording response')
                        flixVars.videoStartMs = response.videoStartMs
                        console.log('videoStartMs ' + flixVars.videoStartMs)
                    }

                    console.log('Started video recording')
                    resolve()

                })
            })

        })


    })
}


function stopRecordingVideo(storage) {

    return new Promise((resolve, reject) => {

        console.log('[LD:bg:flix] stopRecordingVideo: send STOP_RECORDING', { helperTabId: storage.helperTabId })
        chrome.tabs.sendMessage(storage.helperTabId, {
            // name: MESSAGE_NAMES.StopRecording,
            name: 'STOP_RECORDING',
        }, {}, function (response) {
            if (chrome.runtime.lastError) {
                console.warn('[LD:bg:flix] stopRecordingVideo: lastError', chrome.runtime.lastError.message)
            }
            console.log('[LD:bg:flix] stopRecordingVideo: helper ack', response)
            resolve(response)
        })


    })


    // flixVars.isRecordingVideo = false
    //
    // flixVars.videoRecorder?.stop()
    //
    // flixVars.videoEndMs = Date.now()
    // TODO compute flixVars.videoStartMs backwards using video duration from blob
}

function sendStream(flixVars) {
    return new Promise((resolve, reject) => {

        chrome.tabs.sendMessage(flixVars.tabId, {
            name: MESSAGE_NAMES.SendStream,
            streamId: flixVars.streamId
        }, {}, function () {

            resolve()
        })
    })
}

function sentMessageToContentScript(msg) {

    return new Promise((resolve, reject) => {

        chrome.tabs.sendMessage({
            ...msg
        }, {}, function () {

            resolve()
        })
    })
}


function startRecordingAIDemoFromBackground(flixVars) {

    // chrome.storage.local.set({recording: true, type: 'AIDemo'})

    return startAIRecording(flixVars)
        .then((tab) => {

            return new Promise((resolve, reject) => {

                chrome.tabs.sendMessage(flixVars.demoData.tabInfo.id, {
                    name: MESSAGE_NAMES.AddEventListeners,
                }, {}, function () {

                    resolve(tab)
                })
            })


        })
        .catch((err) => {
            console.log(err)

            chrome.storage.local.set({ recording: false })
            return Promise.reject(err)
        })
}

function startRecordingDemoFromBackground(flixVars) {

    // chrome.storage.local.set({recording: true, type: 'FlixDemo'})

    return start(flixVars)
        .then((helperTab) => {

            return new Promise((resolve, reject) => {

                chrome.tabs.sendMessage(flixVars.tabId, {
                    name: MESSAGE_NAMES.AddEventListeners,
                }, {}, function () {

                    resolve(helperTab)
                })
            })


        })
        .catch((err) => {
            console.log(err)

            chrome.storage.local.set({ recording: false })
            return Promise.reject(err)
        })
}

async function startRecordingVideoFromBackground(flixVars) {
    clearCursorPositions(flixVars)

    // chrome.tabs.executeScript(
    //   {
    //     file: 'content-script.js',
    //     allFrames: true,
    //   },
    //   () => {
    //
    //   })

    await new Promise((resolve) => {
        const toStore = { demoData: flixVars.demoData, recording: true, type: 'Video' }
        if (flixVars.authData) {
            toStore.authData = flixVars.authData
        }
        chrome.storage.local.set(toStore, resolve)
    })

    try {
        return await startRecordingVideoWithHelperTab(flixVars)
    } catch (err) {
        console.log(err)

        await new Promise((resolve) => {
            chrome.storage.local.set({ recording: false }, resolve)
        })
    }
}


function stopRecordingDemoFromBackground(flixVars, storage) {

    const recordedTabId = getRecordedTabId(flixVars)
        || storage?.demoData?.tabInfo?.id
        || storage?.demoData?.tabInfo?.tabId

    console.log('[LD:bg:flix] stopRecordingDemoFromBackground', { recordedTabId, type: flixVars.type })

    if (recordedTabId) {
        chrome.tabs.sendMessage(recordedTabId, {
            name: MESSAGE_NAMES.RemoveEventListeners,
        }, () => void chrome.runtime.lastError)
    }

    return Promise.resolve()
        .then(() => {

            // chrome.browserAction.setBadgeText({
            //   text: '',
            // })

            flixVars.recording = false
            return chrome.storage.local.set({ recording: false })
                .then(() => {
                    return stop(flixVars, storage)

                })
                .catch((error) => {
                    // Ensure flag stays false even if stop() fails mid-flight
                    clearRecordingBadge()
                    flixVars.recording = false
                    return chrome.storage.local.set({ recording: false }).then(() => {
                        throw error
                    })
                })

        })
}


export {
    getBlobFromUrl,
    persistLightFlixVars,
    clearRecordingBadge,
    startRecordingVideoFromBackground,
    uploadVideo,
    resetVars,
    sendStream,
    afterRecordingVideo,
    startRecordingVideoWithHelperTab,
    startTakingScreenshots,
    resumeRecordingAfterSwRestart,
    startRecordingDemoFromBackground,
    stopRecordingDemoFromBackground,
    startRecordingAIDemoFromBackground,
    flix_stopRecording
}
