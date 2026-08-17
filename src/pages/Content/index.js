import frameScript from './frameScript'
import topScript from './topScript'

import ENV from "../../config.json";
import {createPayloadAssembler, splitPayload} from '../../helpers/chunkedPayload'


async function onFetchResponse(resourceUrl, config) {

    // console.log('test')
}

let isInFrameCheck = isInIframe()

const uploadStoryAssembler = createPayloadAssembler()

if (!isInFrameCheck) {

    topScript.setup()
    // injectScript('topScript.bundle.js')


    chrome.runtime.onMessage.addListener((msgObj, msgCommander, sendResponse) => {


        let workspaceId = null
        let storyId = null
        let authToken = null

        if (msgObj.type === 'getStarted') {
            injectScript('captureScript.bundle.js')

            workspaceId = msgObj.workspaceId
            storyId = msgObj.storyId
            authToken = msgObj.authToken

            window.config.workspaceId = workspaceId
            window.config.storyId = storyId
            window.config.authToken = authToken
            // window.postMessage({
            //   type: 'capture'
            // })
        }


        if (msgObj.type === 'getWindowMeasures') {
            sendResponse({
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio
            })
        }

        if (msgObj.type === 'takeManualRecording') {
            injectScript('takeManualRecording.bundle.js')

            window.config.demoData = msgObj.demoData
            // INSERT_YOUR_CODE
            if (msgCommander && msgCommander.tab && msgCommander.tab.id) {
                window.config.demoData = window.config.demoData || {};
                window.config.demoData.tabId = msgCommander.tab.id;
            }
    
            sendResponse({ ok: true })
        }

        if (msgObj.type === 'takeScreenshot') {
            injectScript('takeScreenshot.bundle.js')

            workspaceId = msgObj.workspaceId
            storyId = msgObj.storyId
            authToken = msgObj.authToken

            window.config.workspaceId = workspaceId
            window.config.storyId = storyId
            window.config.authToken = authToken
            sendResponse({ ok: true })

            // window.postMessage({
            //   type: 'capture'
            // })
        }


        if (msgObj.type === 'takeVideo') {
            injectScript('takeVideo.bundle.js')

            workspaceId = msgObj.workspaceId
            storyId = msgObj.storyId
            authToken = msgObj.authToken

            window.config.workspaceId = workspaceId
            window.config.storyId = storyId
            window.config.authToken = authToken
            sendResponse({ ok: true })

        }

        if (msgObj.type === 'domDelta_inject') {
            if (!window.__livedemoDomDeltaBridge) {
                window.__livedemoDomDeltaBridge = true
                window.addEventListener('message', (event) => {
                    if (!event.data || event.data.source !== 'livedemo-dom-delta-recorder') {
                        return
                    }
                    const { source, ...rest } = event.data
                    chrome.runtime.sendMessage(rest, () => {
                        void chrome.runtime.lastError
                    })
                })
            }
            injectScript('domDeltaRecorder.bundle.js')
            // Nudge page script in case it was already injected from a prior navigation
            window.postMessage({ source: 'livedemo-dom-delta-content', type: 'domDelta_pageStart' }, '*')
            sendResponse({ ok: true })
        }

        if (msgObj.type === 'domDelta_requestStop') {
            window.postMessage({ source: 'livedemo-dom-delta-content', type: 'domDelta_pageStop' }, '*')
            sendResponse({ ok: true })
        }

        if (msgObj.type === 'Background-captureStarted') {
            window.postMessage({
                type: 'CaptureComponent-captureStarted',
            })
            //
            // window.postMessage({
            //   type: 'capture',
            //   workspaceId,
            //   storyId
            // })
        }


        if (msgObj.type === 'Background-uploadStoryChunk') {

            let payloadJson = uploadStoryAssembler.add(msgObj.chunkIndex, msgObj.totalChunks, msgObj.chunk)
            sendResponse({ ok: true })

            if (payloadJson) {
                console.log('Background-uploadStoryChunk handler - payload complete')

                let storyId = msgObj.storyId
                let authToken = msgObj.authToken
                let blobData = JSON.parse(payloadJson)

                return handleUploadStory(blobData, authToken)
                    .then(storyDoc => {
                        console.log(`Background-uploadStoryChunk handler - successfully uploaded story ${storyDoc._id}`)

                        const videoBase64 = blobData && blobData.videoBase64
                        if (videoBase64) {
                            // Relay preview video to the page in chunks too;
                            // one postMessage with 100MB+ string can jank/fail.
                            const videoChunks = splitPayload(videoBase64)
                            videoChunks.forEach((chunk, chunkIndex) => {
                                window.postMessage({
                                    type: 'LiveDemoPreview-uploadStoryVideoChunk',
                                    storyId: storyDoc._id || storyId,
                                    chunkIndex: chunkIndex,
                                    totalChunks: videoChunks.length,
                                    chunk: chunk,
                                }, window.location.origin)
                            })
                        }
                    })
            }
        }


        if (msgObj.type === '') {

        }


        return true

    })

} else {

    frameScript.setup()
    // injectScript('frameScript.bundle.js')
}

async function handleUploadStory(payload, authToken) {

    return await fetch(`${ENV.STORIES_API}/stories`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(payload)
    })
        .then(res => {
            if (!res.ok) {
                throw new Error(`stories upload failed: ${res.status}`)
            }
            return res.json();
        })
    //send payload to server
}


function injectScript(url) {

    let scriptElement = document.createElement('script')
    scriptElement.type = 'text/javascript'
    scriptElement.src = chrome.runtime.getURL(url)
    scriptElement.async = false

    // window.addEventListener('load', function () {
    document.getElementsByTagName('head')[0].appendChild(scriptElement)
    // scriptElement.remove()
    // })

}


function isInIframe() {
    try {
        return window !== window.top
    } catch (e) {
        return true
    }
}

function getNewSessionId() {
    return window.crypto.getRandomValues(new Uint32Array(32)).join('')
}


// var copyDoc = (new DOMParser()).parseFromString((new XMLSerializer()).serializeToString(window.document), "text/html")


function resolveURL(resourceURL, baseURI) {
    if (baseURI === undefined) {

        return new URL(resourceURL).href
    } else {

        return new URL(resourceURL, baseURI).href
    }
}


/*
  //Inject those two tags in the new doc

  <meta http-equiv=content-security-policy
    content="default-src 'none'; font-src 'self' data:; img-src 'self' data:; style-src 'unsafe-inline'; media-src 'self' data:; script-src 'unsafe-inline' data:;">


  //This is to remove image duplicates for images with source

  <style>
    img[src="data:,"],
    source[src="data:,"] {
      display: none !important
    }
  </style>

 */
