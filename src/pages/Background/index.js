const prettier = require('prettier')
const url = require('url')
const ENV = require('../../config.json')
const io = require('socket.io-client')
const shortUUID = require('short-uuid')
const axios = require('axios')
import * as flix from './flix'
import * as domDelta from './domDelta'

import {getImage, takeScreenshotAndSend} from './helpers'
import {splitPayload} from '../../helpers/chunkedPayload'

import * as Sentry from '@sentry/browser'

Sentry.init({
    dsn: ENV.SENTRY_DSN,
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true
});

global.Buffer = global.Buffer || require('buffer').Buffer

if (typeof btoa === 'undefined') {
    global.btoa = function (str) {
        return new Buffer(str, 'binary').toString('base64')
    }
}

if (typeof atob === 'undefined') {
    global.atob = function (b64Encoded) {
        return new Buffer(b64Encoded, 'base64').toString('binary')
    }
}

console.log('This prints to the console of the service worker (background script)')

// Payload exceeds the 64MiB tabs.sendMessage cap, so it goes over in ordered
// chunks; each waits for the content-script ack before the next is sent.
// Resolves true when every chunk was acked, false on first failure.
function sendStoryPayloadInChunks(tabId, storyId, payloadJson, authToken) {

    const chunks = splitPayload(payloadJson)

    let promiseChain = Promise.resolve(true)

    chunks.forEach((chunk, chunkIndex) => {

        promiseChain = promiseChain.then((allAcked) => {
            if (!allAcked) {
                return false
            }

            return new Promise((resolve) => {
                chrome.tabs.sendMessage(tabId, {
                    type: 'Background-uploadStoryChunk',
                    storyId: storyId,
                    authToken: authToken,
                    chunkIndex: chunkIndex,
                    totalChunks: chunks.length,
                    chunk: chunk,
                }, {}, function (response) {

                    let err = chrome.runtime.lastError
                    if (err) {
                        console.warn('sendStoryPayloadInChunks:', err.message)
                        resolve(false)
                        return
                    }

                    if (!response || !response.ok) {
                        console.warn('sendStoryPayloadInChunks: chunk not acked', chunkIndex)
                        resolve(false)
                        return
                    }

                    resolve(true)
                })
            })
        })
    })

    return promiseChain
}

function uploadStoryFromBackground(payload, authToken) {
    return fetch(`${ENV.STORIES_API}/stories`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(payload)
    }).then(res => {
        if (!res.ok) {
            throw new Error(`stories upload failed: ${res.status}`)
        }
        return res.json()
    })
}

domDelta.restoreSession().catch((err) => {
    console.error('domDelta restoreSession failed', err)
})

var synchRequestsTimer = null
var isAttached = false
var isRecording = false


var contentBuffer = ''


var flixVarsGlobal = {
    flix_IsAttached: false,
    flix_IsRecording: false,

    demoTitle: '', //(await getCurrentTabInfo()).title
    capturedEvents: [],
    cursorPositions: [],
    demoClickCount: 0,
    lastDemoEvent: undefined,
    aspectRatio: 1,

    videoTabId: 0,
    videoRecorder: undefined,
    videoBlobs: [],
    videoStartMs: 0,
    videoEndMs: 0,

    currentScreenshotDataUrl: '',
    screenshots: {},
}

var flixVars = {...flixVarsGlobal}

// MV3: service worker may restart mid-recording; re-register listeners and screenshot loop.
chrome.storage.local.get(null).then((storage) => {
    if (storage.recording === true && storage.type === 'FlixDemo' && !storage.stopInProgress) {
        flixVars = {...flixVarsGlobal, ...storage}
        flix.resumeRecordingAfterSwRestart(flixVars)
    }
})

/** Prefer message payload; otherwise use auth persisted in chrome.storage.local (login / popup sync). */
function resolveAuthDataForRecording(msgObj, callback) {
    if (msgObj && msgObj.authData && msgObj.authData.token) {
        callback(msgObj.authData)
        return
    }
    chrome.storage.local.get(['authData'], (result) => {
        callback(result && result.authData)
    })
}

chrome.runtime.onInstalled.addListener(function (event) {
    console.log('Installed .....')

    console.log(event)
    console.log('Flix reset vars .....')

    flix.resetVars(flixVars)
        .then(() => {

            chrome.storage.local.get(null)
                .then((storageVars) => {
                    flixVars = {...flixVarsGlobal, ...storageVars}
                })

        })

})

function clearRecordingFlag(flixVarsRef) {
    if (flixVarsRef) {
        flixVarsRef.recording = false
        flixVarsRef.stopInProgress = false
        flixVarsRef.IsAttached = false
    }
    flix.clearRecordingBadge()
    return chrome.storage.local.set({
        recording: false,
        stopInProgress: false,
        IsAttached: false,
    })
}

// Helper tab closed mid-record → hard clear so new tabs do not resume listeners
chrome.tabs.onRemoved.addListener(function (tabId) {
    if (flixVars.helperTabId && tabId === flixVars.helperTabId) {
        console.log('helper tab removed — clear recording flag')
        flixVars.helperTabId = 0
        clearRecordingFlag(flixVars)
    }
})

chrome.storage.onChanged.addListener(function (changes, areaName) {
    console.log('storage.onChanged ')
    console.log('changes')
    console.log(changes)

})

chrome.commands.onCommand.addListener((command) => {
    console.log(`Command: ${JSON.stringify(command, null, 2)}`);

    if (command === 'capturePage') {

        chrome.tabs.query({active: true, lastFocusedWindow: true}, function (tabs) {
            const tab = tabs[0]

            // console.log('tab')
            // console.log(tab)

            chrome.tabs.sendMessage(tab.id, {type: 'Background-captureStarted'}, function (msg) {
                msg = msg || {}
                // console.log('Sending capture event to content script')

            })
        })
    }
});

chrome.runtime.onMessage.addListener(function (msgObj, sendCommander, sendCommandResp) {

    // console.log('new message to background')
    // console.log(msgObj)

    if (msgObj.type === 'flixCheckContentScript') {


        chrome.windows.getLastFocused({ populate: true, windowTypes: ['normal'] }, function (win) {
            const tab = win && win.tabs && win.tabs.find((t) => t.active)

            if (!tab) {
                console.log('[LD:bg] flixCheckContentScript: no normal-window tab')
                sendCommandResp({ status: false })
                return
            }
            // console.log('tab')
            // console.log(tab)

            chrome.tabs.sendMessage(tab.id, {name: 'flix_checkContentScript'}, function (msg) {
                msg = msg || {}
                // console.log('Content script response to flix_checkContentScript')
                console.log(msg)

                if (!msg.status) {

                    console.log('will reload')

                    Promise.all([
                        chrome.scripting.executeScript({
                            target: {tabId: tab.id, allFrames: true},
                            files: ["contentScript.bundle.js"]
                        })
                    ]).then(() => {

                        sendCommandResp({status: true, tabInfo: tab})
                    })


                    // chrome.tabs.reload(tab.id, {})
                    //     .then(() => {
                    //
                    //         sendCommandResp({status: true, tabInfo: tab})
                    //     })

                } else {

                    sendCommandResp({status: true, tabInfo: tab})
                }
            })

        })
    }

    if (msgObj.type === 'flixCheckRecording') {

        console.log('[LD:bg] flixCheckRecording: reading storage')

        chrome.storage.local.get(null, function (checkRecordingStorage) {

            console.log('[LD:bg] flixCheckRecording: storage snapshot', {
                IsAttached: checkRecordingStorage.IsAttached,
                recording: checkRecordingStorage.recording,
                stopInProgress: checkRecordingStorage.stopInProgress,
                type: checkRecordingStorage.type,
                helperTabId: checkRecordingStorage.helperTabId,
            })

            sendCommandResp({
                IsAttached: checkRecordingStorage.IsAttached,
                recording: checkRecordingStorage.recording === true,
                stopInProgress: checkRecordingStorage.stopInProgress === true,
            })
        })

        // let result = { IsAttached: flixVars.IsAttached }
        // console.log(result)
        // sendCommandResp(result)

    }


    // StoryDemo
    if (msgObj.type === 'fetch') {
        console.log(msgObj)
        let {resourceURL, config} = msgObj.data
        let accept = '*/*'


        fetch(resourceURL, {
            referrer: config.resourceReferrer,
            headers: {accept},
            cache: 'force-cache'
        })
            .then(async (response) => {
                let buffer = await response.arrayBuffer()
                let buffBase64 = Buffer.from(buffer).toString('base64')
                // let buff16 = ''

                if (resourceURL.includes('gravatar')) {

                    console.log('gravatar')
                }

                // if (buffer.byteLength) {
                //
                //   try {
                //
                //     buff16 = new DataView(buffer).getUint16()
                //   } catch (err) {
                //
                //     console.log(err)
                //   }
                // }

                // let objectUrl = URL.createObjectURL(buffer)
                let headers = {}
                for (let entry of response.headers.entries()) {
                    let [key, value] = entry
                    headers[key] = value
                }

                // let buff16
                // if (buffer.byteLength) {
                //   buff16 = buffer
                // } else {
                //   buff16 = ''
                // }


                sendCommandResp({
                    buffer: buffBase64,
                    headers: JSON.stringify(headers)
                    // objectUrl
                })
            })
            .catch(err => {

                console.log(err)

                sendCommandResp({
                    buffer: '',
                    headers: '{}'
                    // objectUrl
                })
            })

    }

    if (msgObj.type === 'captureChunk') {

        console.log(msgObj)
        let {content} = msgObj

        contentBuffer += content

        sendCommandResp({
            success: true
        })

    }

    if (msgObj.type === 'captureChunksFinished') {


        console.log(msgObj)
        let {name, workspaceId, storyId, authToken} = msgObj


        getImage()
            .then((imageData) => {

                return fetch(`${ENV.STORIES_API}/workspaces/${workspaceId}/stories/${storyId}/screens`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name,
                        content: contentBuffer,
                        imageData: imageData
                    })
                })
            })
            .then((response) => {
                contentBuffer = ''

                sendCommandResp({
                    success: true
                })
            })
            .catch(error => {
                contentBuffer = ''

                sendCommandResp({
                    success: false,
                    error: error
                })

            })


    }

    if (msgObj.type === 'captureFullFinished') {


        console.log(msgObj)
        let {name, workspaceId, content, storyId, width, height, authToken} = msgObj


        getImage()
            .then((imageData) => {

                return fetch(`${ENV.STORIES_API}/workspaces/${workspaceId}/stories/${storyId}/screens`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name,
                        content: content,
                        imageData: imageData,
                        width: width,
                        height: height
                    })
                })
            })
            .then((response) => {

                sendCommandResp({
                    success: true
                })
            })
            .catch(error => {

                sendCommandResp({
                    success: false,
                    error: error
                })

            })


    }

    if (msgObj.type === 'ld-screenshot-request') {

        let {storyId, workspaceId, authToken} = msgObj

        takeScreenshotAndSend(storyId, workspaceId, authToken)
            .then(() => {
                sendCommandResp({
                    success: true
                })
            })
    }

    if (msgObj.type === 'ld-video-request') {
        let {storyId, workspaceId, authToken} = msgObj
        // console.log('flix_video_startRecording event')

        if (sendCommander && sendCommander.tab && sendCommander.tab.id) {
            flixVars.tabId = sendCommander.tab.id
        }

        flixVars.IsAttached = true
        if (!flixVars.demoData) {
            flixVars.demoData = {}
        }
        flixVars.demoData.storyId = storyId
        flixVars.demoData.workspaceId = workspaceId
        if (authToken) {
            flixVars.authData = {...(flixVars.authData || {}), token: authToken}
        }
        flixVars.recording = true
        flixVars.type = 'Video'

        chrome.action.setIcon({path: 'logo-recording-128.png'})

        flix.startRecordingVideoFromBackground(flixVars)
            .then(({helperTab, window}) => {

                if (flixVars.tabId && helperTab.id) {

                    console.log('flixVars saved')
                    flixVars.helperTabId = helperTab.id
                    flixVars.helperWindowId = window.id

                    flix.persistLightFlixVars(flixVars)
                        .then(() => {

                            sendCommandResp('Started recording video')
                        })
                }


            })


    }

    if (msgObj.type === 'flix_stopRecording' || msgObj.type === 'stopRecording') {

        console.log('[LD:bg] flix_stopRecording: message received', {
            type: msgObj.type,
            hasDemoData: !!msgObj.demoData,
            hasAuth: !!(msgObj.authData && msgObj.authData.token),
            flixVarsRecording: flixVars.recording,
            flixVarsType: flixVars.type,
        })

        flix.flix_stopRecording(flixVars, flixVarsGlobal, sendCommandResp)
    }

    if (msgObj.type === 'domDelta_startRecording') {
        resolveAuthDataForRecording(msgObj, (authData) => {
            const payload = { ...msgObj, authData }
            domDelta.startRecording(payload)
                .then((result) => {
                    sendCommandResp({ success: true, ...result })
                })
                .catch((err) => {
                    console.error('domDelta_startRecording failed', err)
                    sendCommandResp({ success: false, error: String(err && err.message ? err.message : err) })
                })
        })
    }

    if (msgObj.type === 'domDelta_stopRecording') {
        const fromPage = !!(sendCommander && sendCommander.tab)
        domDelta.stopRecording({ fromPage })
            .then((result) => {
                sendCommandResp(result)
            })
            .catch((err) => {
                console.error('domDelta_stopRecording failed', err)
                sendCommandResp({ success: false, error: String(err && err.message ? err.message : err) })
            })
    }

    if (msgObj.type === 'domDelta_eventsBatch') {
        domDelta.handleEventsBatch(msgObj.events)
        sendCommandResp({ success: true })
    }

    if (msgObj.type === 'domDelta_eventsBatchStart') {
        domDelta.onEventsBatchStart(msgObj)
        sendCommandResp({ success: true })
    }

    if (msgObj.type === 'domDelta_eventsBatchChunk') {
        domDelta.onEventsBatchChunk(msgObj)
        sendCommandResp({ success: true })
    }

    if (msgObj.type === 'domDelta_eventsBatchFinished') {
        domDelta.onEventsBatchFinished(msgObj)
        sendCommandResp({ success: true })
    }

    if (msgObj.type === 'domDelta_click') {
        domDelta.handleClick(msgObj)
        sendCommandResp({ success: true })
    }

    if (msgObj.type === 'domDelta_checkRecording') {
        console.log('[LD:bg] domDelta_checkRecording: restoreSession start')
        // SW may wake with empty in-memory session; restore before answering.
        domDelta.restoreSession()
            .then(() => {
                console.log('[LD:bg] domDelta_checkRecording: restoreSession ok', {
                    isRecording: domDelta.isRecording(),
                })
                sendCommandResp({ IsAttached: !!domDelta.isRecording() })
            })
            .catch((err) => {
                console.error('[LD:bg] domDelta_checkRecording: restoreSession failed', err)
                sendCommandResp({ IsAttached: !!domDelta.isRecording() })
            })
    }


    switch (msgObj.type) {


        case 'flix_getTabInfo':

            // Popup is lastFocusedWindow; it has no tabs. Use the last focused
            // normal browser window instead.
            chrome.windows.getLastFocused({ populate: true, windowTypes: ['normal'] }, (win) => {
                const err = chrome.runtime.lastError
                const tab = win && win.tabs && win.tabs.find((t) => t.active)

                if (err || !tab) {
                    console.log('[LD:bg] flix_getTabInfo: no normal-window tab', err && err.message)
                    sendCommandResp({ tabInfo: null, error: err ? err.message : 'no active tab' })
                    return
                }

                flixVars.demoTitle = tab.title
                sendCommandResp({ tabInfo: tab })
            })

            break

        case 'flix_createMediaStream':

            flixVars.streamId = msgObj.streamId
            flixVars.tabId = msgObj.tabId

            flix.sendStream(flixVars)
                .then(() => {

                    sendCommandResp(true)
                })

            break


        case 'flix_saveAutoRecordingId':
            let autoRecordingId = msgObj.data.autoRecordingId

            chrome.storage.local.set({autoRecordingId})
                .then(() => {

                    sendCommandResp('Saved autoRecordingId')
                })
            break;
        case 'flix_startRecording': {
            resolveAuthDataForRecording(msgObj, (authData) => {
                if (!authData || !authData.token) {
                    console.error('flix_startRecording: missing authData (log in via the app or extension)')
                    sendCommandResp({
                        success: false,
                        error: 'Not authenticated',
                    })
                    return
                }

                const applyTabAndStart = (tab) => {
                    if (!msgObj.demoData) {
                        msgObj.demoData = {}
                    }
                    if (tab && tab.id) {
                        flixVars.tabId = tab.id
                        if (!msgObj.demoData.tabInfo) {
                            msgObj.demoData.tabInfo = tab
                        }
                        if (!msgObj.demoData.demoTitle && tab.title) {
                            msgObj.demoData.demoTitle = tab.title
                        }
                        if (!msgObj.demoData.name && tab.title) {
                            msgObj.demoData.name = tab.title
                        }
                    }

                    flixVars.IsAttached = true
                    flixVars.stopInProgress = false
                    flixVars.authData = authData
                    flixVars.demoData = msgObj.demoData
                    flixVars.recording = true
                    flixVars.type = 'FlixDemo'

                    chrome.storage.local.set({
                        recording: true,
                        IsAttached: true,
                        stopInProgress: false,
                        type: 'FlixDemo',
                        demoData: flixVars.demoData,
                        authData: flixVars.authData,
                    })

                    flix.startRecordingDemoFromBackground(flixVars)
                        .then((helperTab) => {

                            if (flixVars.tabId && helperTab && helperTab.id) {

                                console.log('flixVars saved')
                                flixVars.helperTabId = helperTab.id

                                flix.persistLightFlixVars(flixVars)
                                    .then(() => {

                                        sendCommandResp('Started recording')
                                    })
                            } else {
                                console.error('flix_startRecording: missing tabId or helper tab', {
                                    tabId: flixVars.tabId,
                                    helperTab
                                })
                                sendCommandResp({
                                    success: false,
                                    error: 'Failed to open helper tab or capture tab id'
                                })
                            }
                        })
                        .catch((err) => {
                            console.error('flix_startRecording failed', err)
                            sendCommandResp({
                                success: false,
                                error: err && err.message ? err.message : String(err)
                            })
                        })
                }

                const tabFromSender = sendCommander && sendCommander.tab
                if (tabFromSender && tabFromSender.id) {
                    applyTabAndStart(tabFromSender)
                } else {
                    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
                        applyTabAndStart(tabs && tabs[0])
                    })
                }
            })

            break
        }


        case 'flix_startAIRecording':

            console.log('Background - flix_startAIRecording message received')

            resolveAuthDataForRecording(msgObj, (authData) => {
                if (!authData || !authData.token) {
                    console.error('flix_startAIRecording: missing authData')
                    sendCommandResp({
                        success: false,
                        error: 'Not authenticated',
                    })
                    return
                }

                flixVars.IsAttached = true
                flixVars.authData = authData
                flixVars.demoData = msgObj.demoData
                flixVars.recording = true
                flixVars.type = 'AIDemo'

                createAutoRecording(flixVars.demoData.windowMeasures, flixVars.demoData.workspaceId, flixVars.authData.token)
                    .then((autoRecordingDoc) => {
                        flixVars.autoRecordingId = autoRecordingDoc._id

                        flix.persistLightFlixVars(flixVars).then(function () {

                            flix.startRecordingAIDemoFromBackground(flixVars)
                                .then(() => {
                                    sendCommandResp('Started AI recording')
                                })
                        })
                    })
            })


            break


        case 'helper_stopRecording':

            console.log('[LD:bg] helper_stopRecording: start', {
                videoBlobsUrl: msgObj.videoBlobsUrl ? '(set)' : '(missing)',
                videoStartMs: msgObj.videoStartMs,
                videoEndMs: msgObj.videoEndMs,
                helperTabId: flixVars.helperTabId,
            })

            // Hard-clear before async upload/open — resume must not false-positive
            // MV3: the service worker may have restarted; in-memory flixVars loses demoData/authData.
            // Recording start persists those via chrome.storage.local — merge before upload.
            clearRecordingFlag(flixVars)
                .then(() => chrome.storage.local.get(null))
                .then((storage) => {
                    console.log('[LD:bg] helper_stopRecording: storage merged', {
                        hasDemoData: !!storage.demoData,
                        hasAuth: !!(storage.authData && storage.authData.token),
                        type: storage.type,
                        capturedEvents: Array.isArray(storage.capturedEvents) ? storage.capturedEvents.length : 0,
                    })
                    flixVars = {...flixVarsGlobal, ...storage, recording: false}
                    flixVars.videoBlobsUrl = msgObj.videoBlobsUrl
                    flixVars.videoStartMs = msgObj.videoStartMs
                    flixVars.videoEndMs = msgObj.videoEndMs

                    console.log('[LD:bg] helper_stopRecording: fetching blob from helper URL')
                    return flix.getBlobFromUrl(flixVars.videoBlobsUrl)
                })
                .then((videoBlobs) => {
                    console.log('[LD:bg] helper_stopRecording: blob fetched', {
                        size: videoBlobs && videoBlobs.size,
                        type: videoBlobs && videoBlobs.type,
                    })
                    // Helper tab is an extension page (no content script) — tabs.sendMessage
                    // fails with "Receiving end does not exist". Remove by id instead.
                    if (flixVars.helperTabId) {
                        chrome.tabs.remove(flixVars.helperTabId, () => void chrome.runtime.lastError)
                    }
                    return videoBlobs
                })
                .then((videoBlobs) => {

                    flixVars.videoBlobs = videoBlobs

                    console.log('[LD:bg] helper_stopRecording: afterRecordingVideo start')
                    return flix.afterRecordingVideo(flixVars)

                })
                .then(({payload, payloadJson, newStoryId}) => {

                    console.log('[LD:bg] helper_stopRecording: afterRecordingVideo done', {
                        newStoryId,
                        payloadJsonLength: payloadJson && payloadJson.length,
                        screenshotCount: payload && payload.screenshots ? Object.keys(payload.screenshots).length : 0,
                    })

                    chrome.runtime.sendMessage({
                        name: 'popup_recordingCompleted',
                        storyDemo: {_id: newStoryId}
                    }, () => void chrome.runtime.lastError)

                    let authToken = flixVars && flixVars.authData && flixVars.authData.token
                    if (payloadJson && newStoryId) {
                        chrome.tabs.create({'url': `${ENV.SERVER_URL}/livedemos/${newStoryId}`}, function (createdTab) {


                            chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
                                if (updatedTabId === createdTab.id && changeInfo.status === "complete") {
                                    console.log('[LD:bg] helper_stopRecording: preview tab loaded', { tabId: createdTab.id })

                                    sendStoryPayloadInChunks(createdTab.id, newStoryId, payloadJson, authToken)
                                        .then((allAcked) => {
                                            console.log('[LD:bg] helper_stopRecording: chunk upload done', { allAcked })
                                            if (!allAcked) {
                                                console.warn('[LD:bg] helper_stopRecording: chunk relay failed, SW fallback')
                                                return uploadStoryFromBackground(payload, authToken)
                                            }
                                        })
                                        .catch((err) => console.error('story upload failed', err))
                                        .finally(() => {
                                            flix.resetVars(flixVars)
                                                .then(() => {

                                                    chrome.storage.local.get(null)
                                                        .then((storageVars) => {
                                                            flixVars = {...flixVarsGlobal, ...storageVars}
                                                        })


                                                    sendCommandResp({msg: 'Stopped recording'})
                                                    // chrome.runtime.reload()
                                                })
                                        })


                                    // Remove the listener to avoid tracking other updates
                                    chrome.tabs.onUpdated.removeListener(listener);
                                }
                            })


                        })
                    }


                    // chrome.runtime.reload()


                    // sendCommandResp({ msg: 'Stopped recording', liveDemoUrl: res.liveDemoUrl })
                })
                .catch(function (error) {
                    console.error('[LD:bg] helper_stopRecording: failed', error)
                    clearRecordingFlag(flixVars)
                    chrome.runtime.sendMessage({
                        name: 'popup_recordingCompleted',
                        storyDemo: { _id: '' },
                        error: error && error.message ? error.message : String(error)
                    }, () => void chrome.runtime.lastError)
                    sendCommandResp({ success: false, error: String(error && error.message || error) })

                    // cleanStorage()
                })

            break
        case 'helper_video_stopRecording':

            console.log('helper_video_stopRecording response')
            console.log(msgObj)
            chrome.action.setIcon({path: 'logo-recording-128.png'})

            // Hard-clear before async upload so resume path cannot false-positive
            // MV3: the service worker may have restarted; in-memory flixVars loses demoData/authData.
            // Recording start persists those via chrome.storage.local — merge before upload.
            clearRecordingFlag(flixVars)
                .then(() => chrome.storage.local.get(null))
                .then((storage) => {
                    flixVars = {...flixVarsGlobal, ...storage, recording: false}
                    flixVars.videoBlobsUrl = msgObj.videoBlobsUrl
                    flixVars.videoStartMs = msgObj.videoStartMs
                    flixVars.videoEndMs = msgObj.videoEndMs

                    const workspaceId = flixVars.demoData && flixVars.demoData.workspaceId
                    if (!workspaceId) {
                        console.error('helper_video_stopRecording: missing demoData.workspaceId', {
                            hasDemoData: !!flixVars.demoData,
                            storageKeys: storage && Object.keys(storage),
                        })
                        return Promise.reject(new Error('Missing workspaceId for video upload'))
                    }

                    return flix.getBlobFromUrl(flixVars.videoBlobsUrl)
                        .then((videoBlobs) => {

                            flixVars.videoBlobs = videoBlobs

                            return flix.uploadVideo(videoBlobs, workspaceId, flixVars)
                        })
                })
                .then(() => {

                    return chrome.storage.local.set({
                        recording: false,
                        IsAttached: false,
                    })
                })
                .then(() => {

                    chrome.runtime.sendMessage({
                        name: 'popup_video_recordingCompleted'
                    })
                    chrome.action.setIcon({path: 'logo-128.png'})

                    sendCommandResp({success: true})
                })
                .catch(function (error) {
                    console.log('Request failed', error)
                    chrome.action.setIcon({path: 'logo-128.png'})
                    clearRecordingFlag(flixVars)
                    chrome.storage.local.set({ IsAttached: false })

                    // chrome.runtime.reload()

                })

            break

        case 'unauthenticate':
            chrome.storage.local.remove(['authData', 'userWorkspaces', 'currentSelectedWorkspace'])
                .then(() => {

                    console.log('unauthenticated')
                    sendCommandResp('unauthenticated')
                })
            break
    }


    return true
})


function createAutoRecording(windowMeasures, workspaceId, authToken) {


    return fetch(`${ENV.STORIES_API}/workspaces/${workspaceId}/auto-recordings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
            windowMeasures
        })
    })
        .then(res => res.json())
        .then(data => {
            return data
        })
}


chrome.runtime.onMessageExternal.addListener(function (msgObj, sendCommander, sendCommandResp) {

    console.log(msgObj)

    switch (msgObj.type) {
        case 'livedemo_extension_ping':
            sendCommandResp({ installed: true })
            break
        case 'livedemo_extension_action_settings':
            if (chrome.action && typeof chrome.action.getUserSettings === 'function') {
                chrome.action.getUserSettings()
                    .then((settings) => {
                        sendCommandResp({
                            isOnToolbar: typeof settings.isOnToolbar === 'boolean' ? settings.isOnToolbar : null,
                        })
                    })
                    .catch(() => {
                        sendCommandResp({ isOnToolbar: null })
                    })
            } else {
                sendCommandResp({ isOnToolbar: null })
            }
            break
        case 'check_authenticate':
            console.log('bg- check_authenticate called')
            chrome.storage.local.get(['authData'])
                .then((result) => {

                    let hasAuthenticated = result.authData && !!result.authData.token
                    console.log(msgObj)
                    sendCommandResp({hasAuthenticated})
                })
                .catch(err => {
                    console.log(err)
                    console.log('authenticate failed')
                })

            break
        case 'authenticate':
            console.log('bg- authenticate called')
            chrome.storage.local.remove(['authData', 'userWorkspaces', 'currentSelectedWorkspace'])
                .then(() => {

                    return chrome.storage.local.set({'authData': msgObj.authData})
                })
                .then(() => {

                    console.log(msgObj)
                    sendCommandResp(msgObj)
                })
                .catch(err => {
                    console.log(err)
                    console.log('authenticate failed')
                })

            break
        case 'unauthenticate':
            chrome.storage.local.remove(['authData', 'userWorkspaces', 'currentSelectedWorkspace'])
                .then(() => {

                    console.log('unauthenticated')
                    sendCommandResp('unauthenticated')
                })
            break
    }

    return true

})


chrome.runtime.onMessage.addListener(function (msgObj, sendCommander, sendCommandResp) {

    switch (msgObj.type) {
        case 'check_authenticate':
            console.log('bg- check_authenticate called')
            chrome.storage.local.get(['authData'])
                .then((result) => {

                    let hasAuthenticated = result.authData && !!result.authData.token
                    console.log(msgObj)
                    sendCommandResp({hasAuthenticated})
                })
                .catch(err => {
                    console.log(err)
                    console.log('authenticate failed')
                })

            return true
        case 'authenticate':
            console.log('bg- authenticate called')
            chrome.storage.local.remove(['authData', 'userWorkspaces', 'currentSelectedWorkspace'])
                .then(() => {

                    return chrome.storage.local.set({'authData': msgObj.authData})
                })
                .then(() => {

                    console.log(msgObj)
                    sendCommandResp(msgObj)
                })
                .catch(err => {
                    console.log(err)
                    console.log('authenticate failed')
                })

            return true
        case 'unauthenticate':
            chrome.storage.local.remove(['authData', 'userWorkspaces', 'currentSelectedWorkspace'])
                .then(() => {

                    console.log('unauthenticated')
                    sendCommandResp('unauthenticated')
                })
            return true
        default:
            // Keep the channel open: handlers above this switch (flixCheckRecording,
            // flix_stopRecording, domDelta_*) reply asynchronously. return false
            // drops those replies — popup then thinks nothing is recording.
            return true
    }

})

/*

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    const { name, ...rest } = request
    log('[MESSAGE] (background)', name, rest)

    switch (name) {
      case BackgroundMessage.SetUser:
        Sentry.setUser({
          id: request.data?.user?.uid,
        })
        break

      case BackgroundMessage.TakeScreenshot:
        imageRecordService.start((imageUrl: string) => {
          chrome.runtime.sendMessage({
            name: PopupMessage.ScreenshotReady,
            data: { imageUrl: imageUrl },
          })
        })
        break

      case BackgroundMessage.StartRecording:
        startRecordingVideoFromBackground()
        break

      case BackgroundMessage.StopRecording:
        stopRecordingVideoFromBackground()
        break

      case BackgroundMessage.StartRecordingDemo:
        startRecordingDemoFromBackground()
        break

      case BackgroundMessage.StopRecordingDemo:
        stopRecordingDemoFromBackground()
        break
    }
    // Workaround for bug in Chrome 99-101 https://stackoverflow.com/a/71520415
    sendResponse()
  })
 */
