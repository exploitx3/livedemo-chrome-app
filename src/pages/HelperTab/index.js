const MAX_CAPTURE_WIDTH = 2560
const MAX_CAPTURE_HEIGHT = 1440
const RECORDING_FILE_NAME = 'recording.webm'

function tabCapture(tabInfo) {
  // Aim for 1440p (2560×1440): scale tab native size UP into that box when smaller
  // (1080p displays used to stay 1080 because we only took css×dpr then clamped).
  // Never exceed the ceiling.
  const dpr = (tabInfo && tabInfo.devicePixelRatio) || window.devicePixelRatio || 1
  const nativeW = Math.round(((tabInfo && tabInfo.width) || 1920) * dpr)
  const nativeH = Math.round(((tabInfo && tabInfo.height) || 1080) * dpr)
  const upscale = Math.min(MAX_CAPTURE_WIDTH / nativeW, MAX_CAPTURE_HEIGHT / nativeH)
  const scale = Math.max(1, upscale)
  const maxWidth = Math.min(Math.round(nativeW * scale), MAX_CAPTURE_WIDTH)
  const maxHeight = Math.min(Math.round(nativeH * scale), MAX_CAPTURE_HEIGHT)

  return new Promise((resolve) => {
    chrome.tabCapture.capture(
      {
        audio: false,
        video: true,
        videoConstraints: {
          mandatory: {
            maxWidth,
            maxHeight,
            maxFrameRate: 60,
          }
        },
      },
      (stream) => {
        resolve(stream)
      }
    )
  })
}


var vars = {
  videoBlobsUrl: '',
  recorder: null,
}

// OPFS keeps recorded chunks on disk instead of the JS heap, so memory stays
// flat regardless of recording length.
async function createRecordingWritable() {
  const root = await navigator.storage.getDirectory()
  try {
    await root.removeEntry(RECORDING_FILE_NAME)
  } catch (err) {
    // no stale file to remove
  }
  const fileHandle = await root.getFileHandle(RECORDING_FILE_NAME, { create: true })
  const writable = await fileHandle.createWritable()
  return { fileHandle, writable }
}

async function removeRecordingFile() {
  try {
    const root = await navigator.storage.getDirectory()
    await root.removeEntry(RECORDING_FILE_NAME)
  } catch (err) {
    // already gone
  }
}

async function cleanupRecordingArtifacts() {
  if (vars.videoBlobsUrl) {
    URL.revokeObjectURL(vars.videoBlobsUrl)
    vars.videoBlobsUrl = ''
  }
  await removeRecordingFile()
}

function afterStopRecording(videoBlobsUrl, videoStartMs, videoEndMs) {
  return new Promise((resolve, reject) => {

    chrome.runtime.sendMessage({
      type: 'helper_stopRecording',
      videoBlobsUrl: videoBlobsUrl,
      videoStartMs: videoStartMs,
      videoEndMs: videoEndMs,
    }, function (res) {


      console.log('Sent helper_stopRecording message to background')
      resolve(res)
    })
  })

}

function afterStopRecordingVideo(videoBlobsUrl, videoStartMs, videoEndMs) {
  return new Promise((resolve, reject) => {

    chrome.runtime.sendMessage({
      type: 'helper_video_stopRecording',
      videoBlobsUrl: videoBlobsUrl,
      videoStartMs: videoStartMs,
      videoEndMs: videoEndMs,
    }, function (res) {


      console.log('Sent helper_stopRecording message to background')
      resolve(res)
    })
  })

}

async function startTabRecording(tabInfo, timesliceMs, onRecordingFinished) {
  const stream = await tabCapture(tabInfo)

  if (!stream) {
    window.close()
    return null
  }

  let opfs = null
  try {
    opfs = await createRecordingWritable()
  } catch (err) {
    console.log('OPFS unavailable, falling back to in-memory buffering', err)
  }

  let writeQueue = Promise.resolve()
  const memoryChunks = []

  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    audioBitsPerSecond: 0,
    videoBitsPerSecond: 8000000,
  })

  recorder.ondataavailable = (event) => {
    if (!event.data || event.data.size === 0) {
      return
    }

    if (opfs) {
      // Writes must stay sequential; chain them.
      writeQueue = writeQueue.then(() => opfs.writable.write(event.data))
    } else {
      memoryChunks.push(event.data)
    }
  }

  recorder.onstop = () => {
    vars.videoEndMs = Date.now()

    stream.getTracks().forEach(function (track) {
      track.stop()
    })

    const finalize = opfs
      ? writeQueue
        .then(() => opfs.writable.close())
        .then(() => opfs.fileHandle.getFile())
      : Promise.resolve(new Blob(memoryChunks, { type: 'video/webm' }))

    finalize
      .then((fileOrBlob) => {
        // File from OPFS is disk-backed, so this URL does not pin the video in memory.
        const url = URL.createObjectURL(fileOrBlob)
        vars.videoBlobsUrl = url

        return onRecordingFinished(url, vars.videoStartMs, vars.videoEndMs)
      })
      .catch((err) => {
        console.log('Failed to finalize recording', err)
      })
  }

  // Stop recording if stream is ended when tab is closed
  stream.getVideoTracks()[0].onended = () => {
    if (recorder.state !== 'inactive') {
      recorder.stop()
    }
  }

  recorder.start(timesliceMs)
  vars.videoStartMs = Date.now()

  return recorder
}

function startRecording(tabInfo) {
  return startTabRecording(tabInfo, 1500, (url, videoStartMs, videoEndMs) => {
    return afterStopRecording(url, videoStartMs, videoEndMs)
  })
}

function startRecordingVideo(tabInfo) {
  return startTabRecording(tabInfo, 100, (url, videoStartMs, videoEndMs) => {
    // Background fetches the blob URL before responding, so cleanup is safe here.
    return afterStopRecordingVideo(url, videoStartMs, videoEndMs)
      .then(() => cleanupRecordingArtifacts())
      .then(() => {
        window.close()
      })
  })
}


function stopRecording() {

  if (vars.recorder && !vars.videoBlobsUrl) {
    vars.recorder.stop()
  }
}


// Receive data from Current Tab or Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { name, data } = request


  console.log('Event - ' + name)


  switch (name) {
    case 'START_RECORDING':
      if (vars.videoBlobsUrl) {
        vars.videoBlobsUrl = ''
      }

      startRecording(data.tabInfo)
        .then((recorder) => {

          vars.recorder = recorder
          sendResponse({})
        })

      break
    case 'START_VIDEO_RECORDING':
      if (vars.videoBlobsUrl) {
        vars.videoBlobsUrl = ''
      }

      startRecordingVideo(data.tabInfo)
        .then((recorder) => {

          vars.recorder = recorder
          sendResponse({})
        })

      break
    case 'STOP_RECORDING':
      stopRecording()

      sendResponse({})

      break
    case 'CLOSE_TAB':
      cleanupRecordingArtifacts()
        .finally(() => {
          sendResponse({})
          window.close()
        })

      break
    default:
      sendResponse({})
      break
  }

  if (chrome.runtime.lastError) {
    console.log(chrome.runtime.lastError)
  }

  return true

})
