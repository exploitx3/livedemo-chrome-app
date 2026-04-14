import frameScript from './frameScript'
import topScript from './topScript'

import ENV from "../../config.json";


async function onFetchResponse(resourceUrl, config) {

    // console.log('test')
}

let isInFrameCheck = isInIframe()

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


        if (msgObj.type === 'Background-uploadStory') {
            console.log('Background-uploadStory handler')

            let storyId = msgObj.storyId
            let authToken = msgObj.authToken
            let blobData = getJsonFromDataUrl(msgObj.payloadDataUrl)

            console.log('Background-uploadStory - blobData')
            console.log(blobData)
            console.log(`msg: ${JSON.stringify(msgObj)}`)

            return handleUploadStory(blobData, authToken)
                .then(storyDoc => {
                    console.log(`Background-uploadStory handler - successfully uploaded story ${storyDoc._id}`)

                    const videoBase64 = blobData && blobData.videoBase64
                    if (videoBase64) {
                        window.postMessage({
                            type: 'LiveDemoPreview-uploadStoryVideo',
                            storyId: storyDoc._id || storyId,
                            videoBase64
                        }, window.location.origin)
                    }
                })
        }


        if (msgObj.type === '') {

        }


        return true

    })

} else {

    frameScript.setup()
    // injectScript('frameScript.bundle.js')
}

function getJsonFromDataUrl(dataUrl) {
    const base64Part = dataUrl.split(",")[1];
    const jsonString = decodeURIComponent(atob((base64Part)));

    // console.log('decoded jsonString')
    // console.log(jsonString)
    return JSON.parse(jsonString);
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
