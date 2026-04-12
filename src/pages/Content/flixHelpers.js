import short from 'short-uuid'
import TagNames from '../../constants/TagNames'
import { installRecordingTabCursor, removeRecordingTabCursor } from './recordingTabCursor.js'

const MESSAGE_NAMES = {
  CheckContentScript: 'flix_checkContentScript',
  TabInfo: 'ld-tab-info',
  StopRecording: 'ld-stop-recording',
  VideoResults: 'ld-video-results',
  StartAIRecording: 'ld-start-ai-recording',
  StopAIRecording: 'ld-stop-ai-recording',
  StartRecording: 'ld-start-recording',
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

function setupListenersIfStillRecording(flixVars) {
  chrome.storage.local.get(null)
    .then(storage => {
      if (storage.recording) {

        console.log('Still Recording - addEventListeners ')
        addEventListeners(flixVars)

        return storage
      }

    })
}

function setup(flixVars) {

  setupListenersIfStillRecording(flixVars)


  flixVars.handleMessageFromExtenstionHandler = handleMessageFromExtensionClosure(flixVars)

  chrome.runtime.onMessage.addListener(flixVars.handleMessageFromExtenstionHandler)
  // })
}

function destroy(flixVars) {
  // console.log('Flix.destroy')

  removeEventListeners(flixVars)

  chrome.runtime.onMessage.removeListener(flixVars.handleMessageFromExtenstionHandler)
}

const millisecondsPerBlob = 100

function processStream(flixVars, stream) {

  if (!stream) {
    return
  }
  flixVars.videoStream = stream
  flixVars.videoTabId = flixVars.tabInfo.tabId

  flixVars.videoRecorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    audioBitsPerSecond: 0,
  })

  flixVars.videoBlobs = []
  flixVars.videoRecorder.ondataavailable = function (event) {
    // console.log('data-available', event.data.size)

    if (event.data && event.data.size > 0) {
      flixVars.videoBlobs?.push(event.data)
    }
  }

  flixVars.videoRecorder.onstop = function () {

    // sendVideoResultsBackToBackground(flixVars)
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

function sendVideoResultsBackToBackground(flixVars) {

  tryToSendMessageToExtension({
    type: 'flix_videoResults',
    flixVars
  })
}

function startRecording(flixVars) {
  // console.log('Started recording')
  // console.log(flixVars)
  if (flixVars.tabInfo) {
    chrome.storage.local.set(flixVars)
  } else {

    return
  }



  return navigator.mediaDevices.getUserMedia(
    {
      // video: true,
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          minHeight: flixVars.tabInfo.height,
          maxHeight: flixVars.tabInfo.height,
          minWidth: flixVars.tabInfo.width,
          maxWidth: flixVars.tabInfo.width,
          maxFrameRate: 60,
          chromeMediaSourceId: flixVars.streamId
        }
      },
    })
    .then(stream => {

      processStream(flixVars, stream)
      flixVars.videoStartMs = Date.now()

      // console.log('Started recording 2:')
      // console.log(flixVars)
      return
    })
}

function handleMessageFromExtensionClosure(flixVars) {
  return function (message, _sender, sendResponse) {

    if (message.name === MESSAGE_NAMES.StopRecording) {


      flixVars.isRecordingVideo = false

      if (flixVars.videoRecorder) {
        flixVars.videoRecorder.stop()
      }

      flixVars.videoEndMs = Date.now()

      // console.log('Record stopped: ')
      flixVars.videoBlobsUrl = URL.createObjectURL(new Blob(flixVars.videoBlobs, { type: 'video/webm' }))

      // console.log(flixVars)

      sendResponse(flixVars)
    }

    if (message.name === MESSAGE_NAMES.StartRecording) {

      startRecording(flixVars).then(() => {
        sendResponse(flixVars)
      })
    }

    if (message.name === MESSAGE_NAMES.SendStream) {
      // console.log('Got streamId')
      flixVars.streamId = message.streamId
      sendResponse()
    }


    if (message.name === MESSAGE_NAMES.TabInfo) {
      // console.log('Got tabInfo')
      flixVars.tabInfo = message.tabInfo
      sendResponse()
    }

    if (message.name === MESSAGE_NAMES.CheckContentScript) {

      sendResponse({ status: true })
    }

    if (message.name === MESSAGE_NAMES.AddEventListeners) {
      console.log('Got message to add event listeners')

      flixVars.didReportFrameInfo = false
      flixVars.cursorPositions = []
      addEventListeners(flixVars)
      sendResponse()
    } else if (message.name === MESSAGE_NAMES.RemoveEventListeners) {

      console.log('Got message to remove event listeners')
      flixVars.cursorPositions = []
      removeEventListeners(flixVars)
      sendResponse()
    } else if (message.name === MESSAGE_NAMES.StartAIRecording) {

      console.log('ContentScript - Got message to start AIRecording')
      window.postMessage({
        type: 'startAIRecording',
        data: message.data
      }, '*')
      sendResponse()
    } else if (message.name === MESSAGE_NAMES.StopAIRecording) {

      console.log('ContentScript - Got message to stop AIRecording')
      window.postMessage({
        type: 'stopAIRecording',
        data: message.data
      }, '*')
      sendResponse()
    } else if (message.name === MESSAGE_NAMES.PrepareToForwardRecordingData) {

      // console.log('Preparing to forward recording data', message)
      sendResponse()
    } else if (message.name === MESSAGE_NAMES.ForwardRecordingData) {

      // console.log('Got recording data to forward', message)
      sendResponse()
    }

    return true
  }

}

function tryToSendMessageToExtension(message) {
  try {
    chrome.runtime.sendMessage(message)
  } catch (e) {
    if (e && e.message === 'Extension context invalidated.') {
      console.log('Extension was updated; removing event and message listeners')
      destroy(window.flixVars)
    } else {
      console.log('Failed to send event message', e)
    }
  }
}

function detectMouseDownClosure(flixVars) {
  return function (mouseDownEvent) {


    flixVars.mouseIsDown = true
    flixVars.isDragging = false
    flixVars.cursorPositions = []

    let targetHTML = mouseDownEvent && mouseDownEvent.target && mouseDownEvent.target.outerHTML ? mouseDownEvent.target.outerHTML : ''
    let targetElementType = ''
    let targetText = ''
    if(targetHTML) {
      targetElementType = TagNames[mouseDownEvent.target.tagName.toLowerCase()]
    }

    if(targetHTML && targetHTML.length > 1000) {
      targetHTML = targetHTML.slice(0,1000)
    }

    if(targetElementType === TagNames.img && mouseDownEvent.target.alt) {
      targetText = `"${mouseDownEvent.target.alt}" image`
    } else {
      targetText = `"${mouseDownEvent.target.innerText}"`
    }

    const clickId = short.generate()
    const message = {
      name: MESSAGE_NAMES.Click,
      clickId,
      frameX: mouseDownEvent.clientX,
      frameY: mouseDownEvent.clientY,
      timeMs: Date.now(),
      targetElementType,
      targetHTML,
      targetText,
    }

    // console.log("onClick")
    // console.log(message)

    tryToSendMessageToExtension(message)
  }

}

function detectMouseMoveClosure(flixVars) {

  return function (mouseMoveEvent) {

    if (!Array.isArray(flixVars.cursorPositions)) {
      flixVars.cursorPositions = []
    }

    const timeMs = Date.now()
    const frameX = mouseMoveEvent.clientX
    const frameY = mouseMoveEvent.clientY

    const last = flixVars.cursorPositions[flixVars.cursorPositions.length - 1]
    if (last && last.frameX === frameX && last.frameY === frameY) {
      return
    }

    const point = { frameX, frameY, timeMs }

    flixVars.cursorPositions.push(point)

    const message = {
      name: MESSAGE_NAMES.CursorMove,
      frameX,
      frameY,
      timeMs,
    }

    tryToSendMessageToExtension(message)
  }
}

function detectMouseUpClosure(flixVars) {
  return function (mouseUpEvent) {

    flixVars.isDragging = false
    flixVars.mouseIsDown = false
  }
}

function detectScrollClosure(flixVars) {

  return function (scrollEvent) {

    const message = {
      name: MESSAGE_NAMES.Scroll,
      timeMs: Date.now(),
    }
    // console.log('Flix.detectScroll', message)
    tryToSendMessageToExtension(message)
  }
}

function detectKeyPressClosure(flixVars) {

  return function (keyPressEvent) {

    const message = {
      name: MESSAGE_NAMES.KeyPress,
      timeMs: Date.now(),
    }
    // console.log('Flix.detectKeyPress', message)
    tryToSendMessageToExtension(message)
  }
}


function addEventListeners(flixVars) {
  console.log('Adding event listeners')

  flixVars.detectMouseDownHandler = detectMouseDownClosure(flixVars)
  flixVars.detectMouseMoveHandler = detectMouseMoveClosure(flixVars)
  flixVars.detectMouseUpHandler = detectMouseUpClosure(flixVars)
  flixVars.detectScrollHandler = detectScrollClosure(flixVars)
  flixVars.detectKeyPressHandler = detectKeyPressClosure(flixVars)

  document.addEventListener('mousemove', flixVars.detectMouseMoveHandler, true)

  chrome.storage.local.get(['type']).then(({ type }) => {
    if (type === 'Video') {
      installRecordingTabCursor(flixVars)
    }
  })

  document.addEventListener('click', flixVars.detectMouseDownHandler, true)
  // document.addEventListener('mousedown', flixVars.detectMouseDownHandler, true)
  document.addEventListener('mouseup', flixVars.detectMouseUpHandler, true)
  document.addEventListener('scroll', flixVars.detectScrollHandler, true)
  document.addEventListener('keypress', flixVars.detectKeyPressHandler, true)
}

function removeEventListeners(flixVars) {
  console.log('Removing event listeners')

  removeRecordingTabCursor(flixVars)

  document.removeEventListener('mousemove', flixVars.detectMouseMoveHandler, true)
  document.removeEventListener('click', flixVars.detectMouseDownHandler, true)
  // document.removeEventListener('mousedown', flixVars.detectMouseDownHandler, true)
  document.removeEventListener('mouseup', flixVars.detectMouseUpHandler, true)
  document.removeEventListener('scroll', flixVars.detectScrollHandler, true)
  document.removeEventListener('keypress', flixVars.detectKeyPressHandler, true)
}


export default {
  setup,
  setupListenersIfStillRecording,
  destroy
}
