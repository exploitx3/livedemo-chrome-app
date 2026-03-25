function tabCapture(tabInfo) {
  return new Promise((resolve) => {
    chrome.tabCapture.capture(
      {
        audio: false,
        video: true,
        videoConstraints: {
          mandatory: {
            // minWidth: tabInfo.width,
            maxWidth: (tabInfo.width * window.devicePixelRatio) * 2,
            // minHeight: tabInfo.height,
            maxHeight: (tabInfo.height * window.devicePixelRatio) * 2,
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

function sendMessageToTab(tabId, data) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, data, (res) => {
      resolve(res)
    })
  })
}

async function startRecordingOld(option) {
  const stream = await tabCapture()

  if (stream) {
    // call when the stream inactive
    stream.oninactive = () => {
      window.close()
    }

    const videoCache = []
    // const context = new AudioContext();
    // const mediaStream = context.createMediaStreamSource(stream);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      audioBitsPerSecond: 0,
    })

    recorder.ondataavailable = async function (event) {
      console.log(event)
      console.log('data-available', event.data.size)

      // await sendMessageToTab(option.currentTabId, {
      //     type: "FROM_OPTION",
      //     data: event.data.size,
      //   });
    }
    // You can pass some data to current tab
    // await sendMessageToTab(option.currentTabId, {
    //   type: "FROM_OPTION",
    //   data: audioDataArray.length,
    // });


    // Prevent page mute
    // mediaStream.connect(recorder);
    // recorder.connect(context.destination);
    // mediaStream.connect(context.destination);
  } else {
    window.close()
  }
}

function compileRecording(videoBlobs) {
  const blob = new Blob(videoBlobs, {
    type: 'video/webm',
  })

  const url = URL.createObjectURL(blob)
  console.log(`Generated recording at ${url}`)

  return url
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

async function startRecording(tabInfo) {
  const stream = await tabCapture(tabInfo)

  if (stream) {
    // call when the stream inactive
    stream.oninactive = () => {
      // window.close()
    }

    // Set up media recorder
    const mediaConstraints = {
      mimeType: 'video/webm;codecs=vp9',
      audioBitsPerSecond: 0,
      videoBitsPerSecond: 8000000
    }
    let currentRecorder = new MediaRecorder(stream, mediaConstraints)


    // Record tab stream
    let currentBlobs = []
    currentRecorder.ondataavailable = event => {
      console.log('data-available')
      if (event.data && event.data.size > 0) {
        currentBlobs?.push(event.data)
      }
    }

    // When the recording is stopped
    currentRecorder.onstop = () => {
      vars.videoEndMs = Date.now()

      let url = compileRecording(currentBlobs)
      vars.videoBlobsUrl = url

      afterStopRecording(url, vars.videoStartMs, vars.videoEndMs)
        .then(() => {
          // window.close()
        })

      // Stop stream(s)
      stream.getTracks().forEach(function (track) {
        track.stop()
      })
    }

    // Stop recording if stream is ended when tab is closed
    stream.getVideoTracks()[0].onended = () => {
      currentRecorder?.stop()
    }

    debugger
    currentRecorder.start(1500)
    vars.videoStartMs = Date.now()

    return currentRecorder

  } else {
    window.close()
  }
}

async function startRecordingVideo(tabInfo) {
  const stream = await tabCapture(tabInfo)

  if (stream) {
    // call when the stream inactive
    stream.oninactive = () => {
      // window.close()
    }

    // Set up media recorder
    const mediaConstraints = {
      mimeType: 'video/webm;codecs=vp9',
      audioBitsPerSecond: 0,
      videoBitsPerSecond: 8000000,
    }
    let currentRecorder = new MediaRecorder(stream, mediaConstraints)


    // Record tab stream
    let currentBlobs = []
    currentRecorder.ondataavailable = event => {
      console.log('data-available')
      if (event.data && event.data.size > 0) {
        currentBlobs?.push(event.data)
      }
    }

    // When the recording is stopped
    currentRecorder.onstop = () => {
      vars.videoEndMs = Date.now()

      let url = compileRecording(currentBlobs)
      vars.videoBlobsUrl = url

      afterStopRecordingVideo(url, vars.videoStartMs, vars.videoEndMs)
        .then(() => {
          window.close()
        })

      // Stop stream(s)
      stream.getTracks().forEach(function (track) {
        track.stop()
      })
    }

    // Stop recording if stream is ended when tab is closed
    stream.getVideoTracks()[0].onended = () => {
      currentRecorder?.stop()
    }

    currentRecorder.start(100)
    vars.videoStartMs = Date.now()

    return currentRecorder

  } else {
    window.close()
  }
}


function sleep(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function waitForVar(varName, obj, time) {

  return new Promise((resolve) => {
    if (obj[varName]) {

      resolve(obj[varName])
    } else {

      return new Promise((inRes, inRej) => {
        setTimeout(() => {

          resolve(waitForVar(varName, obj, time))

        }, time)
      })
    }

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
      window.close()

      sendResponse({})

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
