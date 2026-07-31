const prettier = require('prettier')
const url = require('url')
const ENV = require('../../config.json')
const io = require('socket.io-client')
const shortUUID = require('short-uuid')
const axios = require('axios')
import * as flix from './flix'
import * as domDelta from './domDelta'

import {getImage, takeScreenshotAndSend} from './helpers'

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
    }
    return chrome.storage.local.set({ recording: false })
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


        chrome.tabs.query({active: true, lastFocusedWindow: true}, function (tabs) {
            const tab = tabs[0]

            if (!tab) {
                console.log('Tab not found')
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


        // console.log('BACKGROUND - flix_checkRecording')

        chrome.storage.local.get(null, function (checkRecordingStorage) {

            // console.log('got storage for checkRecording')
            // console.log(checkRecordingStorage)

            sendCommandResp({
                IsAttached: checkRecordingStorage.IsAttached,
                recording: checkRecordingStorage.recording === true,
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

        console.log('flix_stopRecording')
        console.log(flixVars)

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
        // SW may wake with empty in-memory session; restore before answering.
        domDelta.restoreSession()
            .then(() => {
                sendCommandResp({ IsAttached: !!domDelta.isRecording() })
            })
            .catch((err) => {
                console.error('domDelta_checkRecording restore failed', err)
                sendCommandResp({ IsAttached: !!domDelta.isRecording() })
            })
    }


    switch (msgObj.type) {


        case 'flix_getTabInfo':

            chrome.tabs.query({active: true, lastFocusedWindow: true}, function (tabs) {
                const tab = tabs[0]

                let err = chrome.runtime.lastError
                if (err || !tab) {
                    if (err) {
                        console.log(err.message)
                    }
                    return
                }

                flixVars.demoTitle = tab.title

                let target = {
                    tabId: tab.id
                }
                //
                // return chrome.scripting.executeScript({
                //     target: target, func: () => {
                //
                //       return {
                //         innerWidth: window.innerWidth,
                //         innerHeight: window.innerHeight
                //       }
                //     }
                //   })
                //   .then((measures) => {

                sendCommandResp(
                    {
                        tabInfo: tab
                        // ...measures

                    }
                )
            })

            // })

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
                    flixVars.authData = authData
                    flixVars.demoData = msgObj.demoData
                    flixVars.recording = true
                    flixVars.type = 'FlixDemo'

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

            console.log('helper_stopRecording response')

            // Hard-clear before async upload/open — resume must not false-positive
            clearRecordingFlag(flixVars)

            flixVars.videoBlobsUrl = msgObj.videoBlobsUrl
            flixVars.videoStartMs = msgObj.videoStartMs
            flixVars.videoEndMs = msgObj.videoEndMs

            flix.getBlobFromUrl(flixVars.videoBlobsUrl)
                .then((videoBlobs) => {

                    return new Promise((resolve, reject) => {
                        chrome.tabs.sendMessage(sendCommander.tab.id, {
                            name: 'CLOSE_TAB',
                        }, {}, function (response) {
                            resolve(videoBlobs)
                        })
                    })
                })
                .then((videoBlobs) => {

                    flixVars.videoBlobs = videoBlobs

                    return flix.afterRecordingVideo(flixVars)

                })
                .then(({payloadDataUrl, newStoryId}) => {

                    // Helper tab may have already closed itself after CLOSE_TAB cleanup.
                    chrome.tabs.remove(flixVars.helperTabId, () => {
                        void chrome.runtime.lastError
                    })

                    console.log(`newStoryDemo response - id - ${newStoryId}`)

                    chrome.runtime.sendMessage({
                        name: 'popup_recordingCompleted',
                        storyDemo: {_id: newStoryId}
                    })

                    let authToken = flixVars && flixVars.authData && flixVars.authData.token
                    if (payloadDataUrl && newStoryId) {
                        chrome.tabs.create({'url': `${ENV.SERVER_URL}/livedemos/${newStoryId}`}, function (createdTab) {


                            chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
                                if (updatedTabId === createdTab.id && changeInfo.status === "complete") {
                                    console.log(`Tab ${createdTab.id} has fully loaded!`);

                                    chrome.tabs.sendMessage(createdTab.id, {
                                        type: 'Background-uploadStory',
                                        storyId: newStoryId,
                                        payloadDataUrl: payloadDataUrl,
                                        authToken: authToken
                                    })


                                    flix.resetVars(flixVars)
                                        .then(() => {

                                            chrome.storage.local.get(null)
                                                .then((storageVars) => {
                                                    flixVars = {...flixVarsGlobal, ...storageVars}
                                                })


                                            sendCommandResp({msg: 'Stopped recording'})
                                            // chrome.runtime.reload()
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
                    console.log('Request failed', error)
                    clearRecordingFlag(flixVars)

                    // chrome.runtime.reload()
                    throw error

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
            return false
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
