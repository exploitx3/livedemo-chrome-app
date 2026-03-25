import short from 'short-uuid'
import helpers from './helpers'
import hooks from './hooks'

// empty flixVars used only for tracking addEventListeners


function setup() {
  // console.log('Injected inside iframe')


  let windowFrameId

  var doc = (new DOMParser()).parseFromString((new XMLSerializer()).serializeToString(window.document), 'text/html')

  let config = {
    charset: 'utf-8',
    stylesheets: new Map(),
    styles: new Map(),
    fontDeclarations: new Map(),
    fontFaces: new Map(),
    blockMixedContent: true,
    allFrames: {},
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


  window.addEventListener('message', function(event) {

    if (event.data.type === 'frame__getPageData') {


      windowFrameId = event.data.frameId

      let allFrames = Array.from(document.getElementsByTagName("iframe")).reduce((accum, frameElement) => {

        if (frameElement.style.display === 'none') {
          return accum
        }

        let frameObj = {}
        let frameId = short.generate()

        frameObj.frameId = frameId
        frameObj.frame = frameElement.contentWindow

        accum[frameId] = frameObj

        frameElement.setAttribute('data-ld-id', frameId)

        return accum
      }, {})

      config.allFrames = allFrames

      let frameCount = Object.keys(config.allFrames).length
      // console.log('Iframe id is ' + windowFrameId)
      // console.log('Iframes count is ' + frameCount)


      if (frameCount === 0) {
        window.postMessage({
          type: 'frame__allFramesFinished',
          frameId: windowFrameId
        })
      } else {


        window.addEventListener('message', (event) => {

          if (event.data.type === 'frame__getPageDataFinished') {

            let frameId = event.data.frameId

            if (!config.allFrames[frameId]) {
              return
            }

            config.allFrames[frameId].finished = true
            config.allFrames[frameId].content = event.data.content

            let allFramesFinished = helpers.checkIfAllFramesFinished(config.allFrames)
            if (allFramesFinished) {

              window.postMessage({
                type: 'frame__allFramesFinished',
                frameId: windowFrameId
              })

            }

          }
        })


        Object.entries(config.allFrames).forEach(([_, frameObj]) => {

          frameObj.frame.window.postMessage({
            type: 'frame__getPageData',
            frameId: frameObj.frameId

          }, '*')

        })

      }


    }

    if (event.data.type === 'frame__allFramesFinished') {
      // Process whole page
      capturePage(config)
        .then((content) => {

          let frameId = event.data.frameId

          // console.log(config.allFrames)
          if (frameId) {

            let message = {
              type: 'frame__getPageDataFinished',
              frameId: frameId,
              content: content
            }

            // console.log(message)

            window.parent.postMessage(message, '*')
          }

        })



    }

    // if (event.data.type === 'fromTop') {
    //
    //
    //   let allFrames = window.frames
    //   console.log('Iframes count is ' + allFrames.length)
    //
    //
    //   for (let i = 0; i < allFrames.length; i++) {
    //     console.log('internal frame message post')
    //
    //     allFrames[i].window.postMessage({
    //       type: 'fromTop',
    //       text: 'test'
    //     })
    //   }
    //
    //
    // }

  })


  async function capturePage(config) {

    config.doc = document
    config.document = document

    console.log('In Iframe')


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

    helpers.removeDiscardedResources(config)

    await helpers.resolveStylesheetURLs(config)
    console.log(config)

    helpers.resolveStyleAttributeURLs(config)



    await helpers.processStylesheets(config)

    await helpers.processStyleAttributes(config)

    await helpers.processPageResources(config)

    await helpers.processScripts(config)

    await helpers.getAllContent(config)

    await helpers.processStylesheets(config)


    helpers.replaceStylesheets(config)

    helpers.replaceStyleAttributes(config)

    helpers.removeATagHrefs(config)

    helpers.disableForms(config)

    helpers.replaceCanvasElements(config)

    helpers.insertVideoPosters(config)

    helpers.cleanupPage(config)

    helpers.rewriteFrames(config)

    let pageContent = await helpers.getPageData(config, true)



    return pageContent

  }


}


function labelFrames(frames) {

  for (let i = 0; i < frames.length; i++) {

    let frameId = short.generate()

    frames[i].frameId = frameId
    frames[i].finished = false
  }

}


// (function () {
//
//   setup()
//
// })()


export default {
  setup
}
