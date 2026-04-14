import helpers from './helpers'
import hooks from './hooks'
import short from 'short-uuid'
import flixHelpers from './flixHelpers'
import { installRecordingTabCursor } from './recordingTabCursor.js'

let framesMap = new Map()

let finishedCount = 0

function setupFrames(config) {
  let allFrames = Array.from(document.getElementsByTagName('iframe')).reduce((accum, frameElement) => {
    if (frameElement.style.display === 'none') {
      return accum
    }

    let frameObj = {}
    let frameId = short.generate()
    frameObj.frame = frameElement.contentWindow
    frameObj.frameId = frameId

    accum[frameId] = frameObj
    // framesMap.set(frameElement.frameElement, frameId)
    frameElement.setAttribute('data-ld-id', frameId)

    return accum
  }, {})

  let frameCount = Object.keys(allFrames).length

  // console.log('Iframes count is ' + frameCount)


  if (frameCount === 0) {
    window.postMessage({
      type: 'allFramesFinished'
    })
  } else {

    let handler

    handler = function (event) {


      if (event.data.type === 'frame__getPageDataFinished') {

        let frameId = event.data.frameId

        if (!allFrames[frameId]) {
          return
        }

        // sendProgressUpdateIncrement(10)

        allFrames[frameId].finished = true
        allFrames[frameId].content = event.data.content

        let allFramesFinished = helpers.checkIfAllFramesFinished(allFrames)
        if (allFramesFinished) {
          // if (allFramesFinished && finishedCount === 0) {
          finishedCount += 1
          config.allFrames = allFrames

          window.removeEventListener('message', handler)

          window.postMessage({
            type: 'allFramesFinished'
          })

        }

      }
    }

    window.addEventListener('message', handler)

    Object.entries(allFrames).forEach(([_, frameObj]) => {

      frameObj.frame.window.postMessage({
        type: 'frame__getPageData',
        frameId: frameObj.frameId,
      }, '*')

    })

    // After 45 second capture only the topScript document and remove all uncaptured frames
    let handleTimeoutForIframes = function () {


      let filteredAllFrames = Object.entries(allFrames).reduce((accum, [frameId, frameObj]) => {
        if (frameObj.finished) {
          accum[frameId] = frameObj
        }

        return accum
      }, {})

      allFrames = filteredAllFrames
      config.allFrames = filteredAllFrames

      let allFramesFinished = helpers.checkIfAllFramesFinished(allFrames)
      if (allFramesFinished) {

        window.removeEventListener('message', handler)

        window.postMessage({
          type: 'allFramesFinished'
        })


      }
    }

    setTimeout(handleTimeoutForIframes, 45 * 1000)

  }
}

var doc = null
var config = {}

var flixVars = {
  didReportFrameInfo: false,
  frameInfo: {},
  enableLogging: true,
  mouseIsDown: false,
  isDragging: false,
  cursorPositions: [],
}

window.flixVars = flixVars

function resetConfig() {

  doc = (new DOMParser()).parseFromString((new XMLSerializer()).serializeToString(window.document), 'text/html')

  config = {
    charset: 'utf-8',
    stylesheets: new Map(),
    styles: new Map(),
    fontDeclarations: new Map(),
    fontFaces: new Map(),
    blockMixedContent: true,

    baseURI: doc.baseURI,
    doc: doc,
    document: doc,
    workStyleElement: doc.createElement('style'),
    networkTimeout: 10000,
    loadDeferredImages: true,
    moveStylesInHead: true,
    win: window,
    window: window,
    blockScripts: true,
    insertMetaCSP: true,

  }

}

function setup() {

  // console.log('Injected inside TOP')


  doc = (new DOMParser()).parseFromString((new XMLSerializer()).serializeToString(window.document), 'text/html')

  config = {
    charset: 'utf-8',
    stylesheets: new Map(),
    styles: new Map(),
    fontDeclarations: new Map(),
    fontFaces: new Map(),
    blockMixedContent: true,

    baseURI: doc.baseURI,
    doc: doc,
    document: doc,
    workStyleElement: doc.createElement('style'),
    networkTimeout: 10000,
    loadDeferredImages: true,
    moveStylesInHead: true,
    win: window,
    window: window,
    blockScripts: true,
    insertMetaCSP: true,

  }

  window.config = config

  hooks.setupHooks(config)

  flixHelpers.setup(flixVars)


  function getImage() {

    return new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId(
        {},
        function (streamId) {
          // console.log(streamId)


          resolve(streamId)
        }
      )
    })

  }



  window.addEventListener('message', async function (event) {

    //
    // if (event.data.type === 'startAIRecording') {
    //   let authToken = event.data.data && event.data.data.flixVars && event.data.data.flixVars.authData &&
    //       event.data.data.flixVars.authData.token
    //
    //   let workspaceId = event.data.data && event.data.data.flixVars && event.data.data.flixVars.demoData
    //       && event.data.data.flixVars.demoData.workspaceId
    //       // console.log('capture called')
    //   debugger
    //   let autoRecordingId = await autoRecordingHelpers.setupAutoRecording(workspaceId, authToken)
    //
    //   chrome.runtime.sendMessage(
    //       {
    //         type: 'flix_saveAutoRecordingId',
    //         data: {
    //           autoRecordingId
    //         }
    //       }, (result) => {
    //
    //         let err = chrome.runtime.lastError
    //         if (err) {
    //           console.log(err.message)
    //         }
    //
    //       })
    //
    //         console.log('startAIRecording topScript')
    //   console.log(`startAIRecording topScript - event.data`)
    //   // console.log(JSON.stringify(event.data, null, 2))
    // }
    //
    // if (event.data.type === 'stopAIRecording') {
    //   // console.log('capture called')
    //   let authToken = event.data.data && event.data.data.flixVars && event.data.data.flixVars.authData &&
    //       event.data.data.flixVars.authData.token
    //
    //   let workspaceId = event.data.data && event.data.data.flixVars && event.data.data.flixVars.demoData
    //       && event.data.data.flixVars.demoData.workspaceId
    //   // console.log('capture called')
    //   debugger
    //   await autoRecordingHelpers.completeAutoRecording(event.data.data.autoRecordingId,workspaceId, authToken)
    //
    //   console.log('stopAIRecording topScript')
    // }

    if(event.data.type === 'check_authenticate_content') {
      console.log('called check_authenticate_content')


      chrome.runtime.sendMessage(
        {
          type: 'check_authenticate',
        }, (result) => {

          let err = chrome.runtime.lastError
          if (err) {
            console.log(err.message)
          }

          console.log(result)
          if(!result.hasAuthenticated) {

            console.log('app should authenticate')

            window.postMessage({
              type: 'shouldAuthenticate',
            }, '*')
          } else {

            window.postMessage({
              type: 'contentAppAuthenticated_already'
            }, '*')
            console.log('app should not authenticate')
          }
        })
    }

  if(event.data.type === 'authenticateContent') {
      console.log('called authenticateContent')

      let appId = event.data.appId
      let authData = event.data.authData

      chrome.runtime.sendMessage(
        appId,
        {
          type: 'authenticate',
          authData: authData
        }, (result) => {

          let err = chrome.runtime.lastError
          if (err) {
            console.log(err.message)
          }

          console.log(result)
          if(result) {

            console.log('app authenticated')

            window.postMessage({
              type: 'contentAppAuthenticated_successful',
            }, '*')
          }
        })
    }

    if(event.data.type === 'unauthenticateContent') {
      let appId = event.data.appId

      chrome.runtime.sendMessage(
        appId,
        {
          type: 'unathenticate',
        }, (result) => {

          console.log(result)
          console.log('app unauthenticated')
        })
    }

    if (event.data.type === 'allFramesFinished') {
      // Process whole page

      // if (!(finishedCount === 1 || finishedCount === 0)) {
      //   return
      // }

      capturePage(config)
        .then((content) => {

          let workspaceId = window.config.workspaceId
          let storyId = window.config.storyId
          let authToken = window.config.authToken

          // console.log(config.allFrames)


          let canvas = null
          let track = null


          let captureElement = document.getElementById('capture-main-component')
          captureElement.style = 'display: none;'

          let resultPromise = Promise.resolve()
          let CONTENT_SIZE = 50000000
          let shouldSplitOnChunks = content.content.length > CONTENT_SIZE

          // Handle large strings
          if (shouldSplitOnChunks) {
            let contentArr = chunkSubstr(content.content, CONTENT_SIZE)

            let promiseChain = Promise.resolve()
            for (let i = 0; i < contentArr.length; i++) {
              let chunkStr = contentArr[i]

              promiseChain = promiseChain.then(() => {

                return new Promise((resolve, reject) => {

                  chrome.runtime.sendMessage({
                    type: 'captureChunk',
                    content: chunkStr,
                  }, function (response) {


                    if (response.success) {
                      resolve(response.success)

                    } else {

                      console.log(response.error)
                      reject(response.error)
                    }
                  })
                })

              })
            }

            resultPromise = resultPromise.then(() => {
              return promiseChain
            })
          }


          // console.log('Content Length: ' + content.content.length)

          if(shouldSplitOnChunks) {
            return resultPromise
              .then(() => {


                chrome.runtime.sendMessage({
                  type: 'captureChunksFinished',
                  // content: content.content,
                  name: window.document.baseURI,
                  workspaceId,
                  storyId,
                  authToken,
                }, function (response) {

                  // console.log('captureFinished callback called - sending content to captureComponent')
                  captureElement.style = ''

                  // resetConfig()

                  if (response.success) {

                    window.postMessage({
                      type: 'captureFinished',
                      content: content,

                    })
                  } else {

                    console.log('capture failed')
                    console.log(response.error)
                  }
                })

              })
          } else {

            return resultPromise
              .then(() => {


                chrome.runtime.sendMessage({
                  type: 'captureFullFinished',
                  content: content.content,
                  name: window.document.baseURI,
                  workspaceId,
                  storyId,
                  authToken,
                  width: window.innerWidth,
                  height: window.innerHeight
                }, function (response) {

                  // console.log('captureFinished callback called - sending content to captureComponent')
                  captureElement.style = ''

                  // resetConfig()

                  if (response.success) {

                    window.postMessage({
                      type: 'captureFinished',
                      content: content,

                    })
                  } else {

                    console.log('capture failed')
                    console.log(response.error)
                  }
                })

              })
          }



        })



    }

    if (event.data.type === 'capture') {
      // console.log('capture called')
      setupFrames(config)
    }

    if (event.data.type === 'ld-screenshot-request') {
      // console.log('capture called')

      chrome.runtime.sendMessage({
        type: 'ld-screenshot-request',
        workspaceId: config.workspaceId,
        authToken: config.authToken,
        storyId: config.storyId,
      }, function(res) {
        console.log('ld-screenshot-request response from background - ' + res)
      })
    }

    if (event.data.type === 'ld-video-request') {
      // console.log('capture called')



      chrome.runtime.sendMessage({
        type: 'ld-video-request',
        workspaceId: config.workspaceId,
        authToken: config.authToken,
        storyId: config.storyId,
      }, function(res) {
        console.log('ld-video-request response from background - ' + res)
      })
    }

    if (event.data.type === 'ld-take-video-install-cursor') {
      installRecordingTabCursor(flixVars)
    }

    if (event.data.type === 'flix_startRecording') {

      chrome.runtime.sendMessage(
        {
          type: 'flix_startRecording',
          demoData: window.config.demoData,
        },
        () => {
          const err = chrome.runtime.lastError
          if (err) {
            console.log(err.message)
          }
        }
      )
    }

    // if(event.data.type === 'flix_stopRecording') {
    //   flixHelpers.destroy(flixVars)
    // }

  })

  // window.addEventListener('message', msgObj => {
  //
  //
  // })

// setTimeout(async () => {
//
//
//   window.addEventListener('message', async function (event) {
//
//     if (event.data.type === 'allFramesFinished') {
//       // Process whole page
//
//       let content = await capturePage(config)
//       console.log(config.allFrames)
//
//
//     }
//
//   })
//
//   setupFrames(config)
//
//
// }, 10000)

}

function chunkSubstr(str, size) {
  const numChunks = Math.ceil(str.length / size)
  const chunks = new Array(numChunks)

  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size)
  }

  return chunks
}

function sendProgressUpdateIncrement(value) {


  window.postMessage({
    type: 'updateProgress',
    value: value,
  }, '*')
}

async function capturePage(config) {

  config.doc = document
  config.document = document

  // console.log('not in Iframe')


  let docData = helpers.preProcessDoc(config)

  let doc = (new DOMParser()).parseFromString((new XMLSerializer()).serializeToString(window.document), 'text/html')

  config.doc = doc
  config.document = doc

  config.canvases = docData.canvases
  config.fonts = docData.fonts

  config.stylesheets = docData.stylesheets

  config.requests = new Map()

  config.images = docData.images
  config.posters = docData.posters
  config.videos = docData.videos
  config.usedFonts = docData.usedFonts
  config.shadowRoots = docData.shadowRoots
  config.referrer = docData.referrer

  config.markedElements = docData.markedElements
  config.invalidElements = docData.invalidElements

  helpers.preProcessPage(config)

  sendProgressUpdateIncrement(25)

  helpers.removeDiscardedResources(config)

  helpers.resolveStyleAttributeURLs(config)

  await helpers.resolveStylesheetURLs(config)

  // sendProgressUpdateIncrement(5)


  console.log(config)



  await helpers.processStylesheets(config)

  // sendProgressUpdateIncrement(5)


  await helpers.processStyleAttributes(config)

  // sendProgressUpdateIncrement(5)

  await helpers.processPageResources(config)

  // sendProgressUpdateIncrement(5)

  await helpers.processScripts(config)

  // sendProgressUpdateIncrement(5)

  await helpers.getAllContent(config)


  // sendProgressUpdateIncrement(25)


  helpers.replaceStylesheets(config)
  console.log('helpers.replaceStylesheets')

  helpers.replaceStyleAttributes(config)
  console.log('helpers.replaceStyleAttributes')

  helpers.removeATagHrefs(config)
  console.log('helpers.removeATagHrefs')

  helpers.disableForms(config)
  console.log('helpers.disableForms')

  helpers.replaceCanvasElements(config)
  console.log('helpers.replaceCanvasElements')

  helpers.insertVideoPosters(config)
  console.log('helpers.insertVideoPosters')

  helpers.cleanupPage(config)
  console.log('helpers.cleanupPage')

  helpers.rewriteFrames(config)
  console.log('helpers.rewriteFrames')

  sendProgressUpdateIncrement(25)

  let pageContent = await helpers.getPageData(config, false)
  // console.log(pageContent)
  console.log('helpers.pageContent')

  return pageContent

}


// (function () {
//
//   setup()
//
// })()

export default {
  setup
}
