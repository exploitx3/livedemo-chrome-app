import * as cssTree from 'css-tree'
import { MIMEType } from './modules/mime-type-parser'
import { process } from './modules/html-srcset-parser'
// import * as htmlSerializer from './modules/html-serializer'

const DEBUG = false

const ENUMS = {

  FETCH_REQUEST_EVENT: 'ld.fetchRequest',
  FETCH_RESPONSE_EVENT: 'ld.fetchResponse',

  BLOB_URI_PREFIX: 'blob:',
  DATA_URI_PREFIX: 'data:',
  ABOUT_BLANK_URI: 'about:blank',
  SHADOWROOT_ATTRIBUTE_NAME: 'shadowroot',
  EMPTY_URL: /^https?:\/\/+\s*$/,
  EMPTY_RESOURCE: 'data:,',


  REGEXP_SIMPLE_QUOTES_STRING: /^'(.*?)'$/,
  REGEXP_DOUBLE_QUOTES_STRING: /^"(.*?)"$/,

  HTTP_URI_PREFIX: /^https?:\/\//,
  FILE_URI_PREFIX: /^file:\/\//,
  NOT_EMPTY_URL: /^(https?:\/\/|file:\/\/|blob:).+/,

  ON_BEFORE_CAPTURE_EVENT_NAME: 'ld-on-before-capture',
  ON_AFTER_CAPTURE_EVENT_NAME: 'ld-on-after-capture',
  REMOVED_CONTENT_ATTRIBUTE_NAME: 'data-ld-removed-content',
  HIDDEN_CONTENT_ATTRIBUTE_NAME: 'data-ld-hidden-content',
  KEPT_CONTENT_ATTRIBUTE_NAME: 'data-ld-kept-content',
  HIDDEN_FRAME_ATTRIBUTE_NAME: 'data-ld-hidden-frame',
  PRESERVED_SPACE_ELEMENT_ATTRIBUTE_NAME: 'data-ld-preserved-space-element',
  SHADOW_ROOT_ATTRIBUTE_NAME: 'data-ld-shadow-root-element',
  WIN_ID_ATTRIBUTE_NAME: 'data-ld-win-id',
  IMAGE_ATTRIBUTE_NAME: 'data-ld-image',
  POSTER_ATTRIBUTE_NAME: 'data-ld-poster',
  VIDEO_ATTRIBUTE_NAME: 'data-ld-video',
  CANVAS_ATTRIBUTE_NAME: 'data-ld-canvas',
  STYLE_ATTRIBUTE_NAME: 'data-ld-movable-style',
  INPUT_VALUE_ATTRIBUTE_NAME: 'data-ld-input-value',
  LAZY_SRC_ATTRIBUTE_NAME: 'data-ld-lazy-loaded-src',
  STYLESHEET_ATTRIBUTE_NAME: 'data-ld-stylesheet',
  DISABLED_NOSCRIPT_ATTRIBUTE_NAME: 'data-ld-disabled-noscript',
  SELECTED_CONTENT_ATTRIBUTE_NAME: 'data-ld-selected-content',
  INVALID_ELEMENT_ATTRIBUTE_NAME: 'data-ld-invalid-element',
  ASYNC_SCRIPT_ATTRIBUTE_NAME: 'data-ld-async-script',
  FLOW_ELEMENTS_SELECTOR: '*:not(base):not(link):not(meta):not(noscript):not(script):not(style):not(template):not(title)',
  KEPT_TAG_NAMES: ['NOSCRIPT', 'DISABLED-NOSCRIPT', 'META', 'LINK', 'STYLE', 'TITLE', 'TEMPLATE', 'SOURCE', 'OBJECT', 'SCRIPT', 'HEAD'],

  SINGLE_FILE_UI_ELEMENT_CLASS: 'ld-ui-element',


  PREFIXES_FORBIDDEN_DATA_URI: ['data:text/'],
  PREFIX_DATA_URI_IMAGE_SVG: 'data:image/svg+xml',
  SCRIPT_TAG_FOUND: /<script/gi,
  NOSCRIPT_TAG_FOUND: /<noscript/gi,
  CANVAS_TAG_FOUND: /<canvas/gi,
  SCRIPT_TEMPLATE_SHADOW_ROOT: 'data-template-shadow-root',
  UTF8_CHARSET: 'utf-8',

  REGEXP_URL_HASH: /(#.+?)$/,

  SINGLE_FILE_VARIABLE_NAME_PREFIX: '--ld-img-',
  // const SINGLE_FILE_VARIABLE_MAX_SIZE = 512 * 1024

}

function preProcess(doc, window) {

  doc.querySelectorAll(':not(svg) title, meta, link[href][rel*="icon"]').forEach(
    element => element instanceof window.HTMLElement && doc.head.appendChild(element)
  )
}

function resolveURL(resourceURL, baseURI) {
  if (baseURI === undefined) {

    return new URL(resourceURL).href
  } else {

    return new URL(resourceURL, baseURI).href
  }
}

function moveStylesToHead(doc) {

  doc.querySelectorAll('style').forEach(stylesheet => {

    doc.head.appendChild(stylesheet)
  })
}

async function resolveStylesheetURLs(config) {
  let doc = config.doc

  return await Promise.all(Array.from(doc.querySelectorAll('style, link[rel*=stylesheet]'))
    .map(async element => {

      let mediaText
      if (element.media) {
        mediaText = element.media.toLowerCase()
      }

      const stylesheetInfo = { mediaText }

      if (element.closest('[' + ENUMS.SHADOWROOT_ATTRIBUTE_NAME + ']')) {
        stylesheetInfo.scoped = true
      }
      if (element.tagName === 'LINK' && element.charset) {

        config.charset = element.charset
      }

      await processElement(element, stylesheetInfo, config.stylesheets, config.baseURI, config)
    }))


  async function processElement(element, stylesheetInfo, stylesheets, baseURI, config) {
    let stylesheet

    stylesheets.set(element, stylesheetInfo)

    stylesheet = await getStylesheet(element, baseURI, config)

    if (stylesheet && stylesheet.children) {

      stylesheetInfo.stylesheet = stylesheet
    } else {

      stylesheets.delete(element)
    }
  }

  async function getStylesheet(element, baseURI, options) {
    let stylesheet


    if (element.tagName === 'LINK') {

      stylesheet = await resolveLinkStylesheetURLs(element.href, baseURI, options)
      // } else if (element.sheet) {
      //
      //   let content = Array.from(element.sheet.cssRules).map(cssRule => cssRule.cssText).join('\n')
      //
      //   stylesheet = cssTree.parse(content, { context: 'stylesheet', parseCustomProperty: true })

    } else {

      // let textContent = element.textContent
      //
      // textContent = textContent.replace(/&lt;/g, '<')
      // textContent = textContent.replace(/&gt;/g, '>')
      // textContent = textContent.replace(/&amp;/g, '&')
      // textContent = textContent.replace(/&nbsp;/g, '\u00a0')


      stylesheet = cssTree.parse(element.textContent, { context: 'stylesheet', parseCustomProperty: true })

      const importFound = await resolveImportURLs(stylesheet, baseURI, options)
      if (importFound) {

        stylesheet = cssTree.parse(cssTree.generate(stylesheet),
          {
            context: 'stylesheet',
            parseCustomProperty: true
          }
        )
      }

    }
    return stylesheet
  }
}

async function resolveLinkStylesheetURLs(resourceURL, baseURI, config) {

  resourceURL = normalizeURL(resourceURL)

  if (resourceURL && resourceURL !== baseURI && resourceURL !== ENUMS.ABOUT_BLANK_URI) {

    const content = await getContentInternal(resourceURL, {
      charset: config.charset,
      frameId: config.frameId,
      resourceReferrer: config.resourceReferrer,
      baseURI: config.baseURI,
      blockMixedContent: config.blockMixedContent,
      networkTimeout: config.networkTimeout
    })

    if (content.charset && content.charset !== config.charset && content.charset.toLowerCase() !== config.charset) {
      config = Object.assign({}, config, { charset: getCharset(content.data) })
      return resolveLinkStylesheetURLs(resourceURL, baseURI, config)
    }

    resourceURL = content.resourceURL

    content.data = content.data.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, '\u00a0')

    let stylesheet = cssTree.parse(content.data, { context: 'stylesheet', parseCustomProperty: true })
    const importFound = await resolveImportURLs(stylesheet, resourceURL, config)

    if (importFound) {
      stylesheet = cssTree.parse(cssTree.generate(stylesheet), { context: 'stylesheet', parseCustomProperty: true })
    }

    return stylesheet
  }
}

async function resolveImportURLs(stylesheet, baseURI, config, importedStyleSheets = new Set()) {
  let importFound = false

  await processStylesheetURLs(stylesheet, baseURI, config.workStyleElement)

  const imports = getImportFunctions(stylesheet)

  return await Promise.all(imports.map(async node => {

    const urlNode = cssTree.find(node, node => node.type === 'Url') || cssTree.find(node, node => node.type === 'String')

    let resourceURL = normalizeURL(urlNode.value)

    if (!shouldIgnorePath(resourceURL) && isPathValid(resourceURL)) {

      urlNode.value = ENUMS.EMPTY_RESOURCE

      try {
        resourceURL = resolveURL(resourceURL, baseURI)
      } catch (error) {

        // ignored
      }

      if (isPathValid(resourceURL) && !importedStyleSheets.has(resourceURL)) {

        const content = await getStylesheetContent(resourceURL, config)

        resourceURL = content.resourceURL
        //
        // content.data = getUpdatedResourceContent(resourceURL, content, options)
        //
        // if (content.data && content.data.match(/^<!doctype /i)) {
        //
        //   content.data = ''
        // }

        content.data = content.data.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&amp;/, '&')
          .replace(/&nbsp;/g, '\u00a0')


        const mediaQueryListNode = cssTree.find(node, node => node.type === 'MediaQueryList')

        if (mediaQueryListNode) {

          content.data = wrapMediaQuery(content.data, cssTree.generate(mediaQueryListNode))
        }

        const importedStylesheet = cssTree.parse(content.data, { context: 'stylesheet', parseCustomProperty: true })

        const ancestorStyleSheets = new Set(importedStyleSheets)

        ancestorStyleSheets.add(resourceURL)

        await resolveImportURLs(importedStylesheet, resourceURL, config, ancestorStyleSheets)

        for (let keyName of Object.keys(importedStylesheet)) {

          node[keyName] = importedStylesheet[keyName]
        }

        importFound = true
      }
    }
  }))

  return importFound

  async function getStylesheetContent(resourceURL, config) {

    const content = await getContentInternal(resourceURL, {
      frameId: config.frameId,
      charset: config.charset,
      resourceReferrer: config.resourceReferrer,
      baseURI: config.baseURI,
      blockMixedContent: config.blockMixedContent,
      networkTimeout: config.networkTimeout
    })

    if (content.charset !== config.charset) {

      config = Object.assign({}, config, { charset: getCharset(content.data) })

      return getContentInternal(resourceURL, {
        frameId: config.frameId,
        charset: config.charset,
        resourceReferrer: config.resourceReferrer,
        baseURI: config.baseURI,
        blockMixedContent: config.blockMixedContent,
        networkTimeout: config.networkTimeout
      })

    } else {

      return content
    }
  }

}


let ab2str = function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf))
}

let str2ab = function str2ab(str) {
  var buf = new ArrayBuffer(str.length * 2) // 2 bytes for each char
  var bufView = new Uint16Array(buf)
  for (var i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}

function base64ToArrayBuffer(base64) {
  var binary_string = window.atob(base64)
  var len = binary_string.length
  var bytes = new Uint8Array(len)
  for (var i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i)
  }
  return bytes.buffer
}

function arrayBufferToBase64(buffer) {
  var binary = ''
  var bytes = new Uint8Array(buffer)
  var len = bytes.byteLength
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return Buffer.from(binary).toString('base64')
}

async function getContentFromBackground(resourceURL, config) {

  return new Promise((resolve, reject) => {
    // const event = new CustomEvent(ENUMS.FETCH_REQUEST_EVENT, {
    //   data: {
    //     resourceUrl,
    //     config
    //   }
    // })

    chrome.runtime.sendMessage({
      type: 'fetch',
      data: {
        resourceURL,
        config
      }
    })
      .then(async function (response) {
      // console.log('response from background ')
      // console.log(response)

      // console.log('Response: ', response)

      if (resourceURL.includes('gravatar')) {

        // console.log('gravatar')
      }


      let buffer = base64ToArrayBuffer(response.buffer)
      // let buffer = new Buffer(response.buffer, 'base64').toString('binary')
      response.headers = JSON.parse(response.headers)

      try {
        let contentType = '', charset
        try {

          const mimeType = new MIMEType(response.headers['content-type'])
          contentType = mimeType.type + '/' + mimeType.subtype
          charset = mimeType.parameters.get('charset')
        } catch (error) {
          // ignored
        }
        if (!contentType) {

          contentType = guessMIMEType(config.expectedType, buffer)
        }

        if (!charset && config.charset) {
          charset = config.charset
        }


        let result
        try {

          result = await getFetchResponse(resourceURL, config, buffer, charset, contentType)
        } catch (error) {

          result = await getFetchResponse(resourceURL, config, null, charset)
        }


        resolve(result)
      } catch (error) {

        console.log(error)
        return resolve({ data: config.asBinary ? ENUMS.EMPTY_RESOURCE : '', resourceURL })
      }


    })


    // window.dispatch(event)

    // function onRequest(event) {

    // }

    // window.addEventListener(ENUMS.FETCH_RESPONSE_EVENT, onRequest, false)

  })
}

async function getContentInternal(resourceURL, config) {


  let response, startTime, networkTimeoutId, networkTimeoutPromise, resolveNetworkTimeoutPromise

  const fetchResource = fetch
  const fetchFrameResource = fetch

  if (DEBUG) {
    startTime = Date.now()
    log('  // STARTED download url =', resourceURL, 'asBinary =', config.asBinary)
  }


  if (config.networkTimeout) {

    networkTimeoutPromise = new Promise((resolve, reject) => {

      resolveNetworkTimeoutPromise = resolve

      networkTimeoutId = setTimeout(() => reject(new Error('network timeout')), config.networkTimeout)
    })
  } else {

    networkTimeoutPromise = new Promise(resolve => {

      resolveNetworkTimeoutPromise = resolve
    })
  }

  if (config.blockMixedContent && /^https:/i.test(config.baseURI) && !/^https:/i.test(resourceURL)) {

    return getFetchResponse(resourceURL, config)
  }

  try {

    const accept = '*/*'

    if (config.frameId) {

      // try {

        response = await Promise.race([

          fetchFrameResource(resourceURL, {
            frameId: config.frameId,
            referrer: config.resourceReferrer,
            headers: { accept }
          }),
          networkTimeoutPromise
        ])
      // } catch (error) {
      //
      //   response = await Promise.race([
      //
      //     getContentFromBackground(resourceURL, { headers: { accept } }),
      //     networkTimeoutPromise
      //   ])
      // }
    } else {

      response = await Promise.race([

        fetchResource(resourceURL, { referrer: config.resourceReferrer, headers: { accept } }),
        networkTimeoutPromise
      ])
    }
  } catch (error) {


    return getContentFromBackground(resourceURL, config)
  } finally {

    resolveNetworkTimeoutPromise()
    if (config.networkTimeout) {

      clearTimeout(networkTimeoutId)
    }

  }

  let buffer
  try {

    buffer = await response.arrayBuffer()
  } catch (error) {

    return { data: config.asBinary ? ENUMS.EMPTY_RESOURCE : '', resourceURL }
  }

  resourceURL = response.url || resourceURL


  let contentType = '', charset
  try {

    const mimeType = new MIMEType(response.headers.get('content-type'))
    contentType = mimeType.type + '/' + mimeType.subtype
    charset = mimeType.parameters.get('charset')
  } catch (error) {
    // ignored
  }
  if (!contentType) {

    contentType = guessMIMEType(config.expectedType, buffer)
  }

  if (!charset && config.charset) {
    charset = config.charset
  }

  try {

    return getFetchResponse(resourceURL, config, buffer, charset, contentType)
  } catch (error) {

    return getFetchResponse(resourceURL, config, null, charset)
  }
  // if (config.asBinary) {
  //
  //   if (response.status >= 400) {
  //     return getFetchResponse(resourceURL, config)
  //   }
  //
  //   try {
  //     if (DEBUG) {
  //       log('  // ENDED   download url =', resourceURL, 'delay =', Date.now() - startTime)
  //     }
  //
  //     if (config.maxResourceSizeEnabled && buffer.byteLength > config.maxResourceSize * ONE_MB) {
  //
  //       return getFetchResponse(resourceURL, config)
  //     } else {
  //
  //       return getFetchResponse(resourceURL, config, buffer, null, contentType)
  //     }
  //   } catch (error) {
  //
  //     return getFetchResponse(resourceURL, config)
  //   }
  //
  // } else {
  //
  //   if (response.status >= 400 || (config.validateTextContentType && contentType && !contentType.startsWith(PREFIX_CONTENT_TYPE_TEXT))) {
  //
  //     return getFetchResponse(resourceURL, config)
  //   }
  //   if (!charset) {
  //     charset = 'utf-8'
  //   }
  //
  //   if (DEBUG) {
  //     log('  // ENDED   download url =', resourceURL, 'delay =', Date.now() - startTime)
  //   }
  //
  //   if (config.maxResourceSizeEnabled && buffer.byteLength > config.maxResourceSize * ONE_MB) {
  //
  //     return getFetchResponse(resourceURL, config, null, charset)
  //
  //   } else {
  //
  //     try {
  //
  //       return getFetchResponse(resourceURL, config, buffer, charset, contentType)
  //     } catch (error) {
  //
  //       return getFetchResponse(resourceURL, config, null, charset)
  //     }
  //   }
  // }

}

function insertVariables(config, resourceContentMap) {
  console.log('insertVariables')


  if (config.requests.size) {
    const requestKeys = [...config.requests.keys()]

    const chunkSize = 5000;
    let chunksArray = []
    let chunkArray = []
    for (let i = 0; i < requestKeys.length; i += 1) {

      let requestKey = requestKeys[i]
      let value = config.requests.get(requestKey)

      chunkArray.push({
        index: i,
        key: requestKey,
        value: value
      })

      if((i % chunkSize === 0 && i !== 0) || i === requestKeys.length - 1) {

        chunksArray.push([...chunkArray])

        chunkArray.length = 0
      }
    }


    // console.log('All requests: ')
    // console.log(JSON.stringify(requestKeys))

    // console.log(chunksArray)
    for (let i = 0; i < chunksArray.length; i++) {
      let chunkArr = chunksArray[i]


      let stylesheetContent = ''

      for (let j = 0; j < chunkArr.length; j++) {
        let arrObj = chunkArr[j]

        let urlIndex = arrObj.index
        let key = arrObj.key
        let arrayOfCallbacks = arrObj.value

        let { resourceURL, frameId, resourceReferrer, expectedType, charset, asBinary, networkTimeout, blockMixedContent, baseURI }
          = JSON.parse(key)

        let {data : content} = resourceContentMap.get(key)

        if (expectedType === 'image' && arrayOfCallbacks.length > 1) {



          stylesheetContent += `\n${ENUMS.SINGLE_FILE_VARIABLE_NAME_PREFIX + urlIndex}: `
          stylesheetContent += `/* original URL: ${resourceURL} */ `
          stylesheetContent += `url("${content}")`

          if (stylesheetContent) {
            stylesheetContent += ';\n'
          }

          console.log('resource added - ' + resourceURL)
        }
      }

      // console.log('Root content')
      // console.log(stylesheetContent)

      if(stylesheetContent !== '') {
        const styleElement = config.doc.createElement('style')
        styleElement.setAttribute('ld_keep', 'true')


        const firstStyleElement = config.doc.head.querySelector('style')
        if (firstStyleElement) {

          config.doc.head.insertBefore(styleElement, firstStyleElement)
        } else {

          config.doc.head.appendChild(styleElement)
        }

        styleElement.textContent = ':root{' + stylesheetContent + '}'
        // addStylesheetToStylesheets(styleElement, 12345678 + i, config)

      }
    }





  }
}

async function getAllContent(config) {
  // console.log('getAllContent')



  if (config.requests.size === 0) {
    return Promise.resolve()
  }


  const requestKeys = [...config.requests.keys()]
  // console.log('All requests: ')
  // console.log(JSON.stringify(requestKeys))

  let resourceContentMap = new Map()



  let promiseArray = requestKeys.map(async (key, urlIndex) => {
    let { resourceURL, frameId, resourceReferrer, expectedType, charset, asBinary, networkTimeout, blockMixedContent, baseURI }
      = JSON.parse(key)

    try {

      let content = await getContentInternal(resourceURL, {
        frameId,
        resourceReferrer,
        expectedType,
        charset,
        asBinary,
        networkTimeout,
        blockMixedContent,
        baseURI
      })

      resourceContentMap.set(key, content)

      let allCallbacks = config.requests.get(key)

      if(allCallbacks) {
        let isDuplicate = allCallbacks.length > 1
        for (let i = 0; i < allCallbacks.length; i++) {
          let currentCallback = allCallbacks[i]

          await currentCallback.finalFunc({ ...content, isDuplicate, index: urlIndex })
        }

      }


    } catch (err) {

      console.log(err)
      console.log('Failed getting content for - ' + resourceURL)
    }


  })

  let promiseChain = Promise.resolve()
  promiseArray.forEach(promise => {

    promiseChain = promiseChain.then(async () => {

      return await promise
    })
  })

  await promiseChain

  insertVariables(config, resourceContentMap)

  config.requests.clear()
  resourceContentMap.clear()

}


async function getContent(resourceURL, config, baseConfig, finalFunc) {
  let requestKey = JSON.stringify({ resourceURL, ...config })
  let funcArray = baseConfig.requests.get(requestKey)

  if (!funcArray) {
    funcArray = []
    baseConfig.requests.set(requestKey, funcArray)
  }

  funcArray.push({ finalFunc })

  return Promise.resolve()

}

// function getContent() {
//
// }


function processStylesheetURLs(stylesheet, baseURI, workStylesheet) {
  const urls = getUrlFunctions(stylesheet)

  urls.map(urlNode => {
    const originalResourceURL = urlNode.value
    let resourceURL = normalizeURL(originalResourceURL)

    workStylesheet.textContent = 'tmp { content:"' + resourceURL + '"}'

    if (workStylesheet.sheet && workStylesheet.sheet.cssRules) {
      resourceURL = removeQuotes(workStylesheet.sheet.cssRules[0].style.getPropertyValue('content'))
    }

    if (!testIgnoredPath(resourceURL)) {
      if (!resourceURL || testValidPath(resourceURL)) {
        let resolvedURL
        if (!originalResourceURL.startsWith('#')) {
          try {
            resolvedURL = resolveURL(resourceURL, baseURI)
          } catch (error) {
            // ignored
          }
        }
        if (testValidURL(resolvedURL)) {
          urlNode.value = resolvedURL
        }
      } else {
        urlNode.value = ENUMS.EMPTY_RESOURCE
      }
    }
  })
}

async function getFetchResponse(resourceURL, options, data, charset, contentType) {
  if (data) {

    if (options.asBinary) {
      const reader = new FileReader()

      reader.readAsDataURL(new Blob([data], { type: contentType + (options.charset ? ';charset=' + options.charset : '') }))

      data = await new Promise((resolve, reject) => {
        reader.addEventListener('load', () => resolve(reader.result), false)
        reader.addEventListener('error', reject, false)
      })

    } else {
      const firstBytes = new Uint8Array(data.slice(0, 4))
      if (firstBytes[0] === 132 && firstBytes[1] === 49 && firstBytes[2] === 149 && firstBytes[3] === 51) {
        charset = 'gb18030'
      } else if (firstBytes[0] === 255 && firstBytes[1] === 254) {
        charset = 'utf-16le'
      } else if (firstBytes[0] === 254 && firstBytes[1] === 255) {
        charset = 'utf-16be'
      }
      try {
        data = new TextDecoder(charset).decode(data)
      } catch (error) {
        charset = 'utf-8'
        data = new TextDecoder(charset).decode(data)
      }
    }
  } else {
    data = options.asBinary ? ENUMS.EMPTY_RESOURCE : ''
  }

  return { data, resourceURL, charset }
}


function getCharset(stylesheetContent) {
  const match = stylesheetContent.match(/^@charset\s+"([^"]*)";/i)
  if (match && match[1]) {
    return match[1].toLowerCase().trim()
  }
}

function wrapMediaQuery(stylesheetContent, mediaQuery) {
  if (mediaQuery) {
    return '@media ' + mediaQuery + '{ ' + stylesheetContent + ' }'
  } else {
    return stylesheetContent
  }
}


function isPathValid(resourceURL) {
  return resourceURL && !resourceURL.match(ENUMS.EMPTY_URL)
}


function normalizeURL(url) {
  if (!url || url.startsWith(ENUMS.DATA_URI_PREFIX)) {
    return url
  } else {
    return url.split('#')[0]
  }
}

function getImportFunctions(declarationList) {
  return cssTree.findAll(declarationList, node => node.type == 'Atrule' && node.name == 'import')
}

function resolveHrefs(doc, window, options) {

  doc.querySelectorAll('a[href], area[href], link[href]').forEach(element => {

    const href = element.getAttribute('href').trim()

    if (element.tagName === 'LINK' && element.rel.includes('stylesheet')) {
      if (!isDataURL(href)) {
        element.setAttribute('data-ld-original-href', href)
      }
    }
    if (!shouldIgnorePath(href)) {

      let resolvedURL

      try {
        resolvedURL = resolveURL(href, options.baseURI || options.url)
      } catch (error) {

        // ignored
      }

      if (resolvedURL) {

        const url = normalizeURL(config.url)

        if (resolvedURL.startsWith(url + '#') && !resolvedURL.startsWith(url + '#!') && !config.resolveFragmentIdentifierURLs) {
          resolvedURL = resolvedURL.substring(url.length)
        }

        try {
          element.setAttribute('href', resolvedURL)
        } catch (error) {
          // ignored
        }
      }
    }
  })
}

function shouldIgnorePath(resourceURL) {
  return resourceURL && (resourceURL.startsWith(ENUMS.DATA_URI_PREFIX) || resourceURL === ENUMS.ABOUT_BLANK_URI)
}

function guessMIMEType(expectedType, buffer) {
  if (expectedType == 'image') {
    if (compareBytes([255, 255, 255, 255], [0, 0, 1, 0])) {
      return 'image/x-icon'
    }
    if (compareBytes([255, 255, 255, 255], [0, 0, 2, 0])) {
      return 'image/x-icon'
    }
    if (compareBytes([255, 255], [78, 77])) {
      return 'image/bmp'
    }
    if (compareBytes([255, 255, 255, 255, 255, 255], [71, 73, 70, 56, 57, 97])) {
      return 'image/gif'
    }
    if (compareBytes([255, 255, 255, 255, 255, 255], [71, 73, 70, 56, 59, 97])) {
      return 'image/gif'
    }
    if (compareBytes([255, 255, 255, 255, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255], [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80, 86, 80])) {
      return 'image/webp'
    }
    if (compareBytes([255, 255, 255, 255, 255, 255, 255, 255], [137, 80, 78, 71, 13, 10, 26, 10])) {
      return 'image/png'
    }
    if (compareBytes([255, 255, 255], [255, 216, 255])) {
      return 'image/jpeg'
    }
  }
  if (expectedType == 'font') {
    if (compareBytes([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 76, 80])) {
      return 'application/vnd.ms-fontobject'
    }
    if (compareBytes([255, 255, 255, 255], [0, 1, 0, 0])) {
      return 'font/ttf'
    }
    if (compareBytes([255, 255, 255, 255], [79, 84, 84, 79])) {
      return 'font/otf'
    }
    if (compareBytes([255, 255, 255, 255], [116, 116, 99, 102])) {
      return 'font/collection'
    }
    if (compareBytes([255, 255, 255, 255], [119, 79, 70, 70])) {
      return 'font/woff'
    }
    if (compareBytes([255, 255, 255, 255], [119, 79, 70, 50])) {
      return 'font/woff2'
    }
  }

  function compareBytes(mask, pattern) {
    let patternMatch = true, index = 0
    if (buffer.byteLength >= pattern.length) {
      const value = new Uint8Array(buffer, 0, mask.length)
      for (index = 0; index < mask.length && patternMatch; index++) {
        patternMatch = patternMatch && ((value[index] & mask[index]) == pattern[index])
      }
      return patternMatch
    }
  }
}

function isDataURL(url) {
  return url && (url.startsWith(ENUMS.DATA_URI_PREFIX) || url.startsWith(ENUMS.BLOB_URI_PREFIX))
}

function getUrlFunctions(declarationList) {
  return cssTree.findAll(declarationList, node => node.type == 'Url')
}

function testIgnoredPath(resourceURL) {
  return resourceURL && (resourceURL.startsWith(ENUMS.DATA_URI_PREFIX) || resourceURL === ENUMS.ABOUT_BLANK_URI)
}

function testValidPath(resourceURL) {
  return resourceURL && !resourceURL.match(ENUMS.EMPTY_URL)
}

function testValidURL(resourceURL) {

  return testValidPath(resourceURL) &&
    (resourceURL.match(ENUMS.HTTP_URI_PREFIX) ||
      resourceURL.match(ENUMS.FILE_URI_PREFIX) ||
      resourceURL.startsWith(ENUMS.BLOB_URI_PREFIX)) &&
    resourceURL.match(ENUMS.NOT_EMPTY_URL)
}


function removeQuotes(string) {
  if (string.match(ENUMS.REGEXP_SIMPLE_QUOTES_STRING)) {
    string = string.replace(ENUMS.REGEXP_SIMPLE_QUOTES_STRING, '$1')
  } else {
    string = string.replace(ENUMS.REGEXP_DOUBLE_QUOTES_STRING, '$1')
  }
  return string.trim()
}

async function processStylesheets(config) {

  let styleSheetsArray = [...config.stylesheets]
  await Promise.all(
    styleSheetsArray.map(
      ([, stylesheetInfo]) => {

        if (!stylesheetInfo) {

        }

        if(stylesheetInfo.isExtra) {
          console.log('extra stylesheet processed')
        }

        return processStylesheet(
          stylesheetInfo.stylesheet.children,
          config.baseURI,
          config
        )
      }
    ))
}

async function processStylesheet(cssRules, baseURI, config) {
  const promises = []
  const removedRules = []

  for (let cssRule = cssRules.head; cssRule; cssRule = cssRule.next) {

    const ruleData = cssRule.data

    if (ruleData.type === 'Atrule' && ruleData.name === 'charset') {

      removedRules.push(cssRule)
    } else if (ruleData.block && ruleData.block.children) {

      if (ruleData.type === 'Rule') {

        promises.push(processStyle(ruleData, baseURI, config))
      } else if (ruleData.type === 'Atrule' && (ruleData.name === 'media' || ruleData.name === 'supports')) {

        promises.push(processStylesheet(ruleData.block.children, baseURI, config))
      } else if (ruleData.type === 'Atrule' && ruleData.name === 'font-face') {

        promises.push(processFontFaceRule(ruleData, config))
      }
    }
  }

  removedRules.forEach(cssRule => cssRules.remove(cssRule))
  await Promise.all(promises)

  async function processFontFaceRule(ruleData, config) {

    const urls = getUrlFunctions(ruleData)

    await Promise.all(urls.map(async urlNode => {

      const originalResourceURL = urlNode.value


      const resourceURL = normalizeURL(originalResourceURL)

      if (!testIgnoredPath(resourceURL) && testValidURL(resourceURL)) {

        await getContent(resourceURL,
          {
            asBinary: true,
            expectedType: 'font',
            baseURI,
            networkTimeout: config.networkTimeout,
            blockMixedContent: config.blockMixedContent,
          },
          config,
          function ({ data }) {

            let resourceURLs = config.fontDeclarations.get(urlNode)

            if (!resourceURLs) {

              resourceURLs = []
              config.fontDeclarations.set(urlNode, resourceURLs)
            }

            resourceURLs.push(resourceURL)

            urlNode.value = data

          }
        )


      }
    }))
  }
}

async function processStyle(ruleData, baseURI, config) {
  const urls = getUrlFunctions(ruleData)

  await Promise.all(urls.map(async urlNode => {

    const originalResourceURL = urlNode.value


    const resourceURL = normalizeURL(originalResourceURL)

    if (!testIgnoredPath(resourceURL) && testValidURL(resourceURL)) {

      await getContent(resourceURL,
        {
          asBinary: true,
          expectedType: 'image',
          networkTimeout: config.networkTimeout,
          baseURI: config.baseURI,
          blockMixedContent: config.blockMixedContent,
        }
        , config,
        function ({ data, isDuplicate, index }) {


          if (!originalResourceURL.startsWith('#')) {


            if (isDuplicate) {


              const varNode = cssTree.parse('var(' + ENUMS.SINGLE_FILE_VARIABLE_NAME_PREFIX + index + ')', { context: 'value' })

              for (let keyName of Object.keys(varNode.children.head.data)) {

                urlNode[keyName] = varNode.children.head.data[keyName]
              }

              // cssVariables.set(indexResource, { content, url: originalResourceURL })


            } else {

              urlNode.value = data
            }


          }
        }
      )

    }

  }))
}

function resolveStyleAttributeURLs(config) {

  config.doc.querySelectorAll('[style]').forEach(element => {

    const styleContent = element.getAttribute('style')

    const declarationList = cssTree.parse(styleContent, { context: 'declarationList', parseCustomProperty: true })
    processStylesheetURLs(declarationList, config.baseURI, config.workStyleElement)

    config.styles.set(element, declarationList)
  })
}

async function processStyleAttributes(config) {

  return Promise.all([...config.styles].map(([, stylesheet]) =>
    processStyle(stylesheet, config.baseURI, config)
  ))
}

function initDoc(doc) {
  doc.querySelectorAll('meta[http-equiv=refresh]').forEach(element => {
    element.removeAttribute('http-equiv')
    element.setAttribute('disabled-http-equiv', 'refresh')
  })
}

function preProcessDoc(config) {
  let doc = config.doc
  let win = config.win

  doc.querySelectorAll('noscript:not([' + ENUMS.DISABLED_NOSCRIPT_ATTRIBUTE_NAME + '])').forEach(element => {
    element.setAttribute(ENUMS.DISABLED_NOSCRIPT_ATTRIBUTE_NAME, element.textContent)
    element.textContent = ''
  })
  initDoc(config.doc)
  if (config.doc.head) {
    config.doc.head.querySelectorAll(ENUMS.FLOW_ELEMENTS_SELECTOR).forEach(element => element.hidden = true)
  }

  config.doc.querySelectorAll('svg foreignObject').forEach(element => {

    const flowElements = element.querySelectorAll('html > head > ' + ENUMS.FLOW_ELEMENTS_SELECTOR + ', html > body > ' + ENUMS.FLOW_ELEMENTS_SELECTOR)

    if (flowElements.length) {

      Array.from(element.childNodes).forEach(node => node.remove())

      flowElements.forEach(flowElement => element.appendChild(flowElement))
    }
  })
  const invalidElements = new Map()
  let elementsInfo
  if (config.win && config.doc.documentElement) {

    config.doc.querySelectorAll('button button, a a, p div').forEach(element => {

      const placeHolderElement = doc.createElement('template')

      placeHolderElement.setAttribute(ENUMS.INVALID_ELEMENT_ATTRIBUTE_NAME, '')

      placeHolderElement.content.appendChild(element.cloneNode(true))

      invalidElements.set(element, placeHolderElement)

      element.replaceWith(placeHolderElement)
    })

    elementsInfo = getElementsInfo(doc.documentElement, config)

    if (config.moveStylesInHead) {

      config.doc.querySelectorAll('body style, body ~ style').forEach(element => {

        const computedStyle = config.win.getComputedStyle(element)

        if (computedStyle && testHiddenElement(element, computedStyle)) {

          element.setAttribute(ENUMS.STYLE_ATTRIBUTE_NAME, '')
          elementsInfo.markedElements.push(element)
        }
      })
    }
  } else {

    elementsInfo = {
      canvases: [],
      images: [],
      posters: [],
      videos: [],
      usedFonts: [],
      shadowRoots: [],
      markedElements: []
    }
  }
  return {
    canvases: elementsInfo.canvases,

    fonts: getFontsData(config),
    stylesheets: getStylesheetsData(doc),

    images: elementsInfo.images,
    posters: elementsInfo.posters,
    videos: elementsInfo.videos,
    usedFonts: Array.from(elementsInfo.usedFonts.values()),
    shadowRoots: elementsInfo.shadowRoots,
    referrer: doc.referrer,
    markedElements: elementsInfo.markedElements,
    invalidElements
  }
}


function getFontsData(config) {
  return Array.from(config.fontFaces.values())
}

function addStylesheetToStylesheets(styleElement, styleIndex, config) {

  try {

    const tempStyleElement = config.doc.createElement('style')

    tempStyleElement.textContent = styleElement.textContent
    config.doc.body.appendChild(tempStyleElement)

    const stylesheet = tempStyleElement.sheet
    tempStyleElement.remove()

    if (stylesheet || stylesheet.cssRules.length === styleElement.sheet.cssRules.length) {
      styleElement.setAttribute(ENUMS.STYLESHEET_ATTRIBUTE_NAME, styleIndex)

      let mediaText
      if (styleElement.media) {
        mediaText = styleElement.media.toLowerCase()
      }

      const stylesheetInfo = { mediaText, isExtra: true }


      let content = Array.from(styleElement.sheet.cssRules).map(cssRule => cssRule.cssText).join('\n')

      stylesheetInfo.stylesheet = cssTree.parse(content, { context: 'stylesheet', parseCustomProperty: true })

      // console.log(content)

      styleElement.textContent = content

      config.stylesheets.set(styleElement, stylesheetInfo)
    }
  } catch (error) {
    console.log(error)
    // ignored
  }
}

function getStylesheetsData(doc) {
  if (doc) {
    const contents = new Map()
    doc.querySelectorAll('style').forEach((styleElement, styleIndex) => {
      try {

        const tempStyleElement = doc.createElement('style')

        tempStyleElement.textContent = styleElement.textContent
        doc.body.appendChild(tempStyleElement)

        const stylesheet = tempStyleElement.sheet
        tempStyleElement.remove()

        if (stylesheet || stylesheet.cssRules.length === styleElement.sheet.cssRules.length) {
          styleElement.setAttribute(ENUMS.STYLESHEET_ATTRIBUTE_NAME, styleIndex)

          let mediaText
          if (styleElement.media) {
            mediaText = styleElement.media.toLowerCase()
          }

          const stylesheetInfo = { mediaText }


          let content = Array.from(styleElement.sheet.cssRules).map(cssRule => cssRule.cssText).join('\n')

          stylesheetInfo.stylesheet = cssTree.parse(content, { context: 'stylesheet', parseCustomProperty: true })

          // console.log(content)

          styleElement.textContent = content

          contents.set(styleElement, stylesheetInfo)
        }
      } catch (error) {
        // ignored
      }
    })
    return contents
  }
}

function getElementsInfo(element, config, data =
                           {
                             usedFonts: new Map(),
                             canvases: [],
                             images: [],
                             posters: [],
                             videos: [],
                             shadowRoots: [],
                             markedElements: []
                           },
                         ascendantHidden) {

  let doc = config.doc
  let win = config.win

  const elements = Array.from(element.childNodes).filter(
    node => (node instanceof win.HTMLElement) || (node instanceof win.SVGElement))

  elements.forEach(element => {

    let elementHidden, elementKept, computedStyle

    computedStyle = config.win.getComputedStyle(element)

    // if (element instanceof confing.win.HTMLElement) {
    //
    //   // if (config.removeHiddenElements) {
    //   //
    //   //   elementKept = ((ascendantHidden || element.closest('html > head')) && KEPT_TAG_NAMES.includes(element.tagName)) || element.closest('details')
    //   //   if (!elementKept) {
    //   //     elementHidden = ascendantHidden || testHiddenElement(element, computedStyle)
    //   //     if (elementHidden) {
    //   //       element.setAttribute(HIDDEN_CONTENT_ATTRIBUTE_NAME, '')
    //   //       data.markedElements.push(element)
    //   //     }
    //   //   }
    //   // }
    //
    // }
    //
    // if (!elementHidden) {
    //
    //
    //   // if (config.removeUnusedFonts) {
    //   //   getUsedFont(computedStyle, config, data.usedFonts)
    //   //   getUsedFont(win.getComputedStyle(element, ':first-letter'), config, data.usedFonts)
    //   //   getUsedFont(win.getComputedStyle(element, ':before'), config, data.usedFonts)
    //   //   getUsedFont(win.getComputedStyle(element, ':after'), config, data.usedFonts)
    //   // }
    // }


    getResourcesInfo(element, config, data, elementHidden, computedStyle)

    const shadowRoot = !(element instanceof win.SVGElement) && getShadowRoot(element)

    if (shadowRoot && !element.classList.contains(ENUMS.SINGLE_FILE_UI_ELEMENT_CLASS)) {

      const shadowRootInfo = {}

      element.setAttribute(ENUMS.SHADOW_ROOT_ATTRIBUTE_NAME, data.shadowRoots.length)

      data.markedElements.push(element)
      data.shadowRoots.push(shadowRootInfo)

      getElementsInfo(shadowRoot, config, data, elementHidden)

      shadowRootInfo.content = shadowRoot.innerHTML
      shadowRootInfo.mode = shadowRoot.mode
      try {
        if (shadowRoot.adoptedStyleSheets && shadowRoot.adoptedStyleSheets.length) {
          shadowRootInfo.adoptedStyleSheets = Array.from(shadowRoot.adoptedStyleSheets).map(stylesheet => Array.from(stylesheet.cssRules).map(cssRule => cssRule.cssText).join('\n'))
        }
      } catch (error) {
        // ignored
      }
    }

    getElementsInfo(element, config, data, elementHidden)

    // if (!config.autoSaveExternalSave && config.removeHiddenElements && ascendantHidden) {
    //
    //   if (elementKept || element.getAttribute(KEPT_CONTENT_ATTRIBUTE_NAME) == '') {
    //     if (element.parentElement) {
    //       element.parentElement.setAttribute(KEPT_CONTENT_ATTRIBUTE_NAME, '')
    //       data.markedElements.push(element.parentElement)
    //     }
    //   } else if (elementHidden) {
    //     element.setAttribute(REMOVED_CONTENT_ATTRIBUTE_NAME, '')
    //     data.markedElements.push(element)
    //   }
    // }
  })

  return data
}


function getResourcesInfo(element, config, data, elementHidden, computedStyle) {
  let doc = config.doc
  let win = config.win

  if (element.tagName === 'CANVAS') {
    try {
      data.canvases.push({ dataURI: element.toDataURL('image/png', '') })
      element.setAttribute(ENUMS.CANVAS_ATTRIBUTE_NAME, data.canvases.length - 1)
      data.markedElements.push(element)
    } catch (error) {
      // ignored
    }
  }
  if (element.tagName === 'IMG') {
    const imageData = {
      currentSrc: elementHidden ?
        ENUMS.EMPTY_RESOURCE :
        (config.loadDeferredImages && element.getAttribute(ENUMS.LAZY_SRC_ATTRIBUTE_NAME)) || element.currentSrc
    }

    data.images.push(imageData)
    element.setAttribute(ENUMS.IMAGE_ATTRIBUTE_NAME, data.images.length - 1)
    data.markedElements.push(element)
    element.removeAttribute(ENUMS.LAZY_SRC_ATTRIBUTE_NAME)
    try {
      computedStyle = computedStyle || win.getComputedStyle(element)
    } catch (error) {
      // ignored
    }
    if (computedStyle) {

      imageData.size = getSize(win, element, computedStyle)
      const boxShadow = computedStyle.getPropertyValue('box-shadow')
      const backgroundImage = computedStyle.getPropertyValue('background-image')

      if ((!boxShadow || boxShadow === 'none') &&
        (!backgroundImage || backgroundImage === 'none') &&
        (imageData.size.pxWidth > 1 || imageData.size.pxHeight > 1)) {
        imageData.replaceable = true
        imageData.backgroundColor = computedStyle.getPropertyValue('background-color')
        imageData.objectFit = computedStyle.getPropertyValue('object-fit')
        imageData.boxSizing = computedStyle.getPropertyValue('box-sizing')
        imageData.objectPosition = computedStyle.getPropertyValue('object-position')
      }
    }
  }
  if (element.tagName === 'VIDEO') {

    const src = element.currentSrc
    if (src && !src.startsWith('blob:') && !src.startsWith('data:')) {
      const positionParent = win.getComputedStyle(element.parentNode).getPropertyValue('position')
      data.videos.push({
        positionParent,
        src,
        size: {
          pxWidth: element.clientWidth,
          pxHeight: element.clientHeight
        },
        currentTime: element.currentTime
      })
      element.setAttribute(ENUMS.VIDEO_ATTRIBUTE_NAME, data.videos.length - 1)
    }
    if (!element.poster) {
      const canvasElement = doc.createElement('canvas')
      const context = canvasElement.getContext('2d')
      canvasElement.width = element.clientWidth
      canvasElement.height = element.clientHeight
      try {
        context.drawImage(element, 0, 0, canvasElement.width, canvasElement.height)
        data.posters.push(canvasElement.toDataURL('image/png', ''))
        element.setAttribute(ENUMS.POSTER_ATTRIBUTE_NAME, data.posters.length - 1)
        data.markedElements.push(element)
      } catch (error) {
        // ignored
      }
    }
  }

  // if (element.tagName === "IFRAME") {
  //   if (elementHidden && config.removeHiddenElements) {
  //     element.setAttribute(HIDDEN_FRAME_ATTRIBUTE_NAME, "");
  //     data.markedElements.push(element);
  //   }
  // }

  if (element.tagName === 'INPUT') {
    if (element.type !== 'password') {
      element.setAttribute(ENUMS.INPUT_VALUE_ATTRIBUTE_NAME, element.value)
      data.markedElements.push(element)
    }

    if (element.type === 'radio' || element.type === 'checkbox') {
      element.setAttribute(ENUMS.INPUT_VALUE_ATTRIBUTE_NAME, element.checked)
      data.markedElements.push(element)
    }
  }
  if (element.tagName === 'TEXTAREA') {
    element.setAttribute(ENUMS.INPUT_VALUE_ATTRIBUTE_NAME, element.value)
    data.markedElements.push(element)
  }

  if (element.tagName === 'SELECT') {

    element.querySelectorAll('option').forEach(option => {
      if (option.selected) {
        option.setAttribute(ENUMS.INPUT_VALUE_ATTRIBUTE_NAME, '')
        data.markedElements.push(option)
      }
    })
  }

  if (element.tagName === 'SCRIPT') {
    if (element.async && element.getAttribute('async') !== '' && element.getAttribute('async') !== 'async') {
      element.setAttribute(ENUMS.ASYNC_SCRIPT_ATTRIBUTE_NAME, '')
      data.markedElements.push(element)
    }
    element.textContent = element.textContent.replace(/<\/script>/gi, '<\\/script>')
  }
}


function getSize(win, imageElement, computedStyle) {
  let pxWidth = imageElement.naturalWidth
  let pxHeight = imageElement.naturalHeight
  if (!pxWidth && !pxHeight) {
    const noStyleAttribute = imageElement.getAttribute('style') == null
    computedStyle = computedStyle || win.getComputedStyle(imageElement)
    let removeBorderWidth = false
    if (computedStyle.getPropertyValue('box-sizing') == 'content-box') {
      const boxSizingValue = imageElement.style.getPropertyValue('box-sizing')
      const boxSizingPriority = imageElement.style.getPropertyPriority('box-sizing')
      const clientWidth = imageElement.clientWidth
      imageElement.style.setProperty('box-sizing', 'border-box', 'important')
      removeBorderWidth = imageElement.clientWidth != clientWidth
      if (boxSizingValue) {
        imageElement.style.setProperty('box-sizing', boxSizingValue, boxSizingPriority)
      } else {
        imageElement.style.removeProperty('box-sizing')
      }
    }
    let paddingLeft, paddingRight, paddingTop, paddingBottom, borderLeft, borderRight, borderTop, borderBottom
    paddingLeft = getWidth('padding-left', computedStyle)
    paddingRight = getWidth('padding-right', computedStyle)
    paddingTop = getWidth('padding-top', computedStyle)
    paddingBottom = getWidth('padding-bottom', computedStyle)
    if (removeBorderWidth) {
      borderLeft = getWidth('border-left-width', computedStyle)
      borderRight = getWidth('border-right-width', computedStyle)
      borderTop = getWidth('border-top-width', computedStyle)
      borderBottom = getWidth('border-bottom-width', computedStyle)
    } else {
      borderLeft = borderRight = borderTop = borderBottom = 0
    }
    pxWidth = Math.max(0, imageElement.clientWidth - paddingLeft - paddingRight - borderLeft - borderRight)
    pxHeight = Math.max(0, imageElement.clientHeight - paddingTop - paddingBottom - borderTop - borderBottom)
    if (noStyleAttribute) {
      imageElement.removeAttribute('style')
    }
  }
  return { pxWidth, pxHeight }
}

function getWidth(styleName, computedStyle) {
  if (computedStyle.getPropertyValue(styleName).endsWith('px')) {
    return parseFloat(computedStyle.getPropertyValue(styleName))
  }
}


function preProcessPage(config) {
  if (config.win) {

    config.doc.body.querySelectorAll(':not(svg) title, meta, link[href][rel*="icon"]').forEach(
      element => element instanceof config.win.HTMLElement && config.doc.head.appendChild(element))
  }


  config.doc.querySelectorAll('img[' + ENUMS.IMAGE_ATTRIBUTE_NAME + ']').forEach(imgElement => {

    const attributeValue = imgElement.getAttribute(ENUMS.IMAGE_ATTRIBUTE_NAME)

    if (attributeValue) {

      const imageData = config.images[Number(attributeValue)]
      if (imageData) {


        if (imageData.currentSrc) {
          imgElement.dataset.singleFileOriginURL = imgElement.getAttribute('src')
          imgElement.setAttribute('src', imageData.currentSrc)
        }

        if (config.loadDeferredImages) {

          if ((!imgElement.getAttribute('src') || imgElement.getAttribute('src') === ENUMS.EMPTY_RESOURCE) && imgElement.getAttribute('data-src')) {

            imageData.src = imgElement.dataset.src
            imgElement.setAttribute('src', imgElement.dataset.src)
            imgElement.removeAttribute('data-src')
          }
        }

      }
    }
  })

  if (config.loadDeferredImages) {

    config.doc.querySelectorAll('img[data-srcset]').forEach(imgElement => {

      if (!imgElement.getAttribute('srcset') && imgElement.getAttribute('data-srcset')) {

        imgElement.setAttribute('srcset', imgElement.dataset.srcset)
        imgElement.removeAttribute('data-srcset')
      }
    })
  }
}

async function processPageResources(config) {
  const processAttributeArgs = [
    ['link[href][rel*="icon"]', 'href', false, true],
    ['object[type="image/svg+xml"], object[type="image/svg-xml"]', 'data'],
    ['img[src], input[src][type=image]', 'src', true],
    ['embed[src*=".svg"], embed[src*=".pdf"]', 'src'],
    ['video[poster]', 'poster'],
    ['*[background]', 'background'],
    ['image', 'xlink:href'],
    ['image', 'href']
  ]

  let resourcePromises = processAttributeArgs.map(([selector, attributeName, processDuplicates, removeElementIfMissing]) =>

    processAttribute(config.doc.querySelectorAll(selector),
      attributeName,
      config.baseURI,
      config,
      'image',
      config.styles,
      processDuplicates,
      removeElementIfMissing)
  )
  resourcePromises = resourcePromises.concat([
    processXLinks(config.doc.querySelectorAll('use'), config.doc, config.baseURI, config),
    processSrcset(config.doc.querySelectorAll('img[srcset], source[srcset]'), config.baseURI, config)
  ])

  resourcePromises.push(
    processAttribute(
      config.doc.querySelectorAll('audio[src], audio > source[src]'),
      'src',
      config.baseURI,
      config,
      'audio',
      config.styles)
  )

  resourcePromises.push(
    processAttribute(
      config.doc.querySelectorAll('video[src], video > source[src]'),
      'src',
      config.baseURI,
      config,
      'video',
      config.styles
    )
  )


  await Promise.all(resourcePromises)
  // if (config.saveFavicon) {
  //   ProcessorHelper.processShortcutIcons(this.doc)
  // }
}

async function processAttribute(
  resourceElements,
  attributeName,
  baseURI,
  config,
  expectedType,
  styles,
  processDuplicates,
  removeElementIfMissing) {

  await Promise.all(Array.from(resourceElements).map(async resourceElement => {

    let resourceURL = resourceElement.getAttribute(attributeName)

    if (resourceURL != null) {

      resourceURL = normalizeURL(resourceURL)

      let originURL = resourceElement.dataset.singleFileOriginURL

      if (config.saveOriginalURLs && !isDataURL(resourceURL)) {
        resourceElement.setAttribute('data-ld-original-' + attributeName, resourceURL)
      }

      delete resourceElement.dataset.singleFileOriginURL

      if (!config['block' + expectedType.charAt(0).toUpperCase() + expectedType.substring(1) + 's']) {

        if (!testIgnoredPath(resourceURL)) {

          setAttributeEmpty(resourceElement, attributeName, expectedType)
          if (testValidPath(resourceURL)) {

            try {

              resourceURL = resolveURL(resourceURL, baseURI)
            } catch (error) {
              // ignored
            }
            if (testValidURL(resourceURL)) {
              await getContent(resourceURL,
                {
                  asBinary: true,
                  expectedType,
                  groupDuplicates: config.groupDuplicateImages && resourceElement.tagName === 'IMG' && attributeName === 'src',
                  baseURI: config.baseURI,
                  blockMixedContent: config.blockMixedContent,
                }, config,

                async function ({ data: content }) {

                  if (originURL) {
                    if (content === ENUMS.EMPTY_RESOURCE) {
                      try {
                        originURL = resolveURL(originURL, baseURI)
                      } catch (error) {
                        // ignored
                      }
                      try {
                        resourceURL = originURL
                        content = (await getContentInternal(resourceURL, {
                          asBinary: true,
                          expectedType,
                          maxResourceSize: config.maxResourceSize,
                          maxResourceSizeEnabled: config.maxResourceSizeEnabled,
                          frameId: config.windowId,
                          resourceReferrer: config.resourceReferrer,
                          acceptHeaders: config.acceptHeaders,
                          networkTimeout: config.networkTimeout,
                          baseURI: config.baseURI,
                          blockMixedContent: config.blockMixedContent,
                        })).data
                      } catch (error) {
                        // ignored
                      }
                    }

                  }
                  if (removeElementIfMissing && content === ENUMS.EMPTY_RESOURCE) {
                    resourceElement.remove()
                  } else if (content !== ENUMS.EMPTY_RESOURCE) {

                    const forbiddenPrefixFound = ENUMS.PREFIXES_FORBIDDEN_DATA_URI.filter(prefixDataURI => content.startsWith(prefixDataURI)).length
                    if (!forbiddenPrefixFound) {
                      const isSVG = content.startsWith(ENUMS.PREFIX_DATA_URI_IMAGE_SVG)


                      resourceElement.setAttribute(attributeName, content)
                    }
                  }

                })


            }
          }
        }
      } else {
        setAttributeEmpty(resourceElement, attributeName, expectedType)
      }
    }
  }))

  function setAttributeEmpty(resourceElement, attributeName, expectedType) {
    if (expectedType == 'video' || expectedType == 'audio') {
      resourceElement.removeAttribute(attributeName)
    } else {
      resourceElement.setAttribute(attributeName, ENUMS.EMPTY_RESOURCE)
    }
  }
}

async function processXLinks(resourceElements, doc, baseURI, config) {
  let attributeName = 'xlink:href'

  await Promise.all(Array.from(resourceElements).map(async resourceElement => {

    let originalResourceURL = resourceElement.getAttribute(attributeName)
    if (originalResourceURL == null) {

      attributeName = 'href'
      originalResourceURL = resourceElement.getAttribute(attributeName)
    }

    if (config.saveOriginalURLs && !isDataURL(originalResourceURL)) {

      resourceElement.setAttribute('data-ld-original-href', originalResourceURL)
    }

    let resourceURL = normalizeURL(originalResourceURL)


    if (testValidPath(resourceURL) && !testIgnoredPath(resourceURL)) {

      resourceElement.setAttribute(attributeName, ENUMS.EMPTY_RESOURCE)
      try {

        resourceURL = resolveURL(resourceURL, baseURI)
      } catch (error) {
        // ignored
      }
      if (testValidURL(resourceURL)) {

        const hashMatch = originalResourceURL.match(REGEXP_URL_HASH)

        if (originalResourceURL.startsWith(baseURI + '#')) {

          resourceElement.setAttribute(attributeName, hashMatch[0])
        } else {

          const { data } = await getContentInternal(resourceURL, {
            expectedType: 'image',
            baseURI: config.baseURI,
            blockMixedContent: config.blockMixedContent,
          })

          const svgDoc = parseSVGContent(data)
          if (hashMatch && hashMatch[0]) {

            let symbolElement
            try {

              symbolElement = svgDoc.querySelector(hashMatch[0])
            } catch (error) {
              // ignored
            }
            if (symbolElement) {

              resourceElement.setAttribute(attributeName, hashMatch[0])
              resourceElement.parentElement.insertBefore(symbolElement, resourceElement.parentElement.firstChild)
            }
          } else {

            const content = await getContentInternal(resourceURL, {
              expectedType: 'image',
              baseURI: config.baseURI,
              blockMixedContent: config.blockMixedContent,
            })
            resourceElement.setAttribute(attributeName, ENUMS.PREFIX_DATA_URI_IMAGE_SVG + ',' + content.data)
          }
        }
      }
    } else if (resourceURL === config.url) {
      resourceElement.setAttribute(attributeName, originalResourceURL.substring(resourceURL.length))
    }
  }))
}

function parseSrcset(srcset) {
  return process(srcset)
}

async function processSrcset(resourceElements, baseURI, config) {

  await Promise.all(Array.from(resourceElements).map(async resourceElement => {

    const originSrcset = resourceElement.getAttribute('srcset')
    const srcset = parseSrcset(originSrcset)

    if (config.saveOriginalURLs && !isDataURL(originSrcset)) {
      resourceElement.setAttribute('data-ld-original-srcset', originSrcset)
    }
    if (!config.blockImages) {

      const srcsetValues = await Promise.all(srcset.map(async srcsetValue => {

        let resourceURL = normalizeURL(srcsetValue.url)
        if (!testIgnoredPath(resourceURL)) {
          if (testValidPath(resourceURL)) {
            try {
              resourceURL = resolveURL(resourceURL, baseURI)
            } catch (error) {
              // ignored
            }
            if (testValidURL(resourceURL)) {
              await getContent(resourceURL, {
                asBinary: true, expectedType: 'image',
                baseURI: config.baseURI,
                blockMixedContent: config.blockMixedContent,
                }, config,
                function ({ data: content }) {

                  const forbiddenPrefixFound = ENUMS.PREFIXES_FORBIDDEN_DATA_URI.filter(
                    prefixDataURI => content.startsWith(prefixDataURI)).length

                  if (forbiddenPrefixFound) {
                    return ''
                  }

                  return content + (srcsetValue.w ? ' ' + srcsetValue.w + 'w' : srcsetValue.d ? ' ' + srcsetValue.d + 'x' : '')


                })

            } else {

              return ''
            }
          } else {

            return ''
          }
        } else {

          return resourceURL + (srcsetValue.w ? ' ' + srcsetValue.w + 'w' : srcsetValue.d ? ' ' + srcsetValue.d + 'x' : '')
        }
      }))

      resourceElement.setAttribute('srcset', srcsetValues.join(', '))
    } else {

      resourceElement.setAttribute('srcset', '')
    }
  }))
}

function getShadowRoot(element) {
  const chrome = window.chrome

  if (element.openOrClosedShadowRoot) {

    return element.openOrClosedShadowRoot
  } else if (chrome && chrome.dom && chrome.dom.openOrClosedShadowRoot) {

    try {
      return chrome.dom.openOrClosedShadowRoot(element)
    } catch (error) {
      return element.shadowRoot
    }

  } else {

    return element.shadowRoot
  }
}

function testHiddenElement(element, computedStyle) {
  let hidden = false

  if (computedStyle) {

    const display = computedStyle.getPropertyValue('display')
    const opacity = computedStyle.getPropertyValue('opacity')
    const visibility = computedStyle.getPropertyValue('visibility')
    hidden = display === 'none'

    if (!hidden && (opacity == '0' || visibility === 'hidden') && element.getBoundingClientRect) {

      const boundingRect = element.getBoundingClientRect()
      hidden = !boundingRect.width && !boundingRect.height
    }
  }

  return Boolean(hidden)
}

function parseSVGContent(content) {
  const doc = (new DOMParser()).parseFromString(content, 'image/svg+xml')
  if (doc.querySelector('parsererror')) {

    return (new DOMParser()).parseFromString(content, 'text/html')
  } else {

    return doc
  }
}


async function processScripts(config) {

  await Promise.all(Array.from(config.doc.querySelectorAll('script[src]')).map(async element => {

    let resourceURL
    let scriptSrc
    scriptSrc = element.getAttribute('src')

    if (config.saveOriginalURLs && !isDataURL(scriptSrc)) {

      element.setAttribute('data-ld-original-src', scriptSrc)
    }

    element.removeAttribute('integrity')
    if (!config.blockScripts) {
      element.textContent = ''
      try {
        // resourceURL = util.resolveURL(scriptSrc, config.baseURI)
      } catch (error) {
        // ignored
      }
      if (testValidURL(resourceURL)) {

        element.removeAttribute('src')
        await getContent(resourceURL, {
          asBinary: true,
          charset: config.charset !== ENUMS.UTF8_CHARSET && config.charset,
          resourceReferrer: config.resourceReferrer,
          baseURI: config.baseURI,
          blockMixedContent: config.blockMixedContent,
          expectedType: 'script',
          networkTimeout: config.networkTimeout
          }, config,
          function (content) {


            content.data = getUpdatedResourceContent(resourceURL, content, config)
            element.setAttribute('src', content.data)
            if (element.getAttribute('async') === 'async' || element.getAttribute(ENUMS.ASYNC_SCRIPT_ATTRIBUTE_NAME) === '') {
              element.setAttribute('async', '')
            }

          })
      }
    } else {

      element.removeAttribute('src')
    }

  }))


  await Promise.all(Array.from(config.doc.querySelectorAll('script')).map(async element => {

    element.textContent = ''
  }))


}

function getUpdatedResourceContent(resourceURL, content, config) {

  if (config.rootDocument && config.updatedResources[resourceURL]) {

    config.updatedResources[resourceURL].retrieved = true

    return config.updatedResources[resourceURL].content

  } else {

    return content.data || ''
  }
}

function replaceStylesheets(config) {

  config.doc.querySelectorAll('style').forEach(styleElement => {

    const stylesheetInfo = config.stylesheets.get(styleElement)

    if (stylesheetInfo) {

      config.stylesheets.delete(styleElement)

      styleElement.textContent = generateStylesheetContent(stylesheetInfo.stylesheet, config)

      if (stylesheetInfo.mediaText) {

        styleElement.media = stylesheetInfo.mediaText
      }

    } else {
      if(!styleElement.getAttribute('ld_keep')) {
        styleElement.remove()
      }
    }
  })

  config.doc.querySelectorAll('link[rel*=stylesheet]').forEach(linkElement => {

    const stylesheetInfo = config.stylesheets.get(linkElement)

    if (stylesheetInfo) {

      config.stylesheets.delete(linkElement)
      const styleElement = config.doc.createElement('style')

      if (stylesheetInfo.mediaText) {
        styleElement.media = stylesheetInfo.mediaText
      }

      styleElement.textContent = generateStylesheetContent(stylesheetInfo.stylesheet, config)

      linkElement.parentElement.replaceChild(styleElement, linkElement)
    } else {

      linkElement.remove()
    }
  })
}

function replaceStyleAttributes(config) {

  config.doc.querySelectorAll('[style]').forEach(element => {

    const declarationList = config.styles.get(element)

    if (declarationList) {

      config.styles.delete(element)

      element.setAttribute('style', generateStylesheetContent(declarationList, config))
    } else {

      element.setAttribute('style', '')
    }
  })
}

function generateStylesheetContent(stylesheet, config) {

  let stylesheetContent = cssTree.generate(stylesheet)


  stylesheetContent = stylesheetContent.replace(/&lt;/g, '<')
  stylesheetContent = stylesheetContent.replace(/&gt;/g, '>')
  stylesheetContent = stylesheetContent.replace(/&amp;/g, '&')
  stylesheetContent = stylesheetContent.replace(/&nbsp;/g, '\u00a0')

  // if (options.saveOriginalURLs) {
  //
  //   stylesheetContent = replaceOriginalURLs(stylesheetContent)
  // }

  return stylesheetContent
}

function cleanupPage(config) {
  config.doc.querySelectorAll('base').forEach(element => element.remove())

  const metaCharset = config.doc.head.querySelector('meta[charset]')

  if (metaCharset) {

    config.doc.head.insertBefore(metaCharset, config.doc.head.firstChild)

    if (config.doc.head.querySelectorAll('*').length === 1 && config.doc.body.childNodes.length === 0) {

      config.doc.head.querySelector('meta[charset]').remove()
    }
  }
}


function postProcessDoc(doc, markedElements, invalidElements) {

  doc.querySelectorAll('[' + ENUMS.DISABLED_NOSCRIPT_ATTRIBUTE_NAME + ']').forEach(element => {
    element.textContent = element.getAttribute(ENUMS.DISABLED_NOSCRIPT_ATTRIBUTE_NAME)
    element.removeAttribute(ENUMS.DISABLED_NOSCRIPT_ATTRIBUTE_NAME)
  })

  doc.querySelectorAll('meta[disabled-http-equiv]').forEach(element => {
    element.setAttribute('http-equiv', element.getAttribute('disabled-http-equiv'))
    element.removeAttribute('disabled-http-equiv')
  })

  if (doc.head) {
    doc.head.querySelectorAll('*:not(base):not(link):not(meta):not(noscript):not(script):not(style):not(template):not(title)').forEach(element => element.removeAttribute('hidden'))
  }

  if (!markedElements) {

    const singleFileAttributes = [
      ENUMS.REMOVED_CONTENT_ATTRIBUTE_NAME,
      ENUMS.HIDDEN_FRAME_ATTRIBUTE_NAME,
      ENUMS.HIDDEN_CONTENT_ATTRIBUTE_NAME,
      ENUMS.PRESERVED_SPACE_ELEMENT_ATTRIBUTE_NAME,
      ENUMS.IMAGE_ATTRIBUTE_NAME,
      ENUMS.POSTER_ATTRIBUTE_NAME,
      ENUMS.VIDEO_ATTRIBUTE_NAME,
      ENUMS.CANVAS_ATTRIBUTE_NAME,
      ENUMS.INPUT_VALUE_ATTRIBUTE_NAME,
      ENUMS.SHADOW_ROOT_ATTRIBUTE_NAME,
      ENUMS.STYLESHEET_ATTRIBUTE_NAME,
      ENUMS.ASYNC_SCRIPT_ATTRIBUTE_NAME
    ]

    markedElements = doc.querySelectorAll(singleFileAttributes.map(name => '[' + name + ']').join(','))
  }

  markedElements.forEach(element => {
    element.removeAttribute(ENUMS.REMOVED_CONTENT_ATTRIBUTE_NAME)
    element.removeAttribute(ENUMS.HIDDEN_CONTENT_ATTRIBUTE_NAME)
    element.removeAttribute(ENUMS.KEPT_CONTENT_ATTRIBUTE_NAME)
    element.removeAttribute(ENUMS.HIDDEN_FRAME_ATTRIBUTE_NAME)
    element.removeAttribute(ENUMS.PRESERVED_SPACE_ELEMENT_ATTRIBUTE_NAME)
    element.removeAttribute(ENUMS.IMAGE_ATTRIBUTE_NAME)
    element.removeAttribute(ENUMS.POSTER_ATTRIBUTE_NAME)
    element.removeAttribute(ENUMS.VIDEO_ATTRIBUTE_NAME)
    element.removeAttribute(ENUMS.CANVAS_ATTRIBUTE_NAME)
    element.removeAttribute(ENUMS.INPUT_VALUE_ATTRIBUTE_NAME)
    element.removeAttribute(ENUMS.SHADOW_ROOT_ATTRIBUTE_NAME)
    element.removeAttribute(ENUMS.STYLESHEET_ATTRIBUTE_NAME)
    element.removeAttribute(ENUMS.ASYNC_SCRIPT_ATTRIBUTE_NAME)
    element.removeAttribute(ENUMS.STYLE_ATTRIBUTE_NAME)
  })

  if (invalidElements) {
    Array.from(invalidElements.entries()).forEach(([element, placeholderElement]) => placeholderElement.replaceWith(element))
  }
}

function parseURL(resourceURL, baseURI) {
  if (baseURI === undefined) {

    return new URL(resourceURL)
  } else {

    return new URL(resourceURL, baseURI)
  }
}

function serializeDoc(doc){
    const docType = doc.doctype;
    let docTypeString = "";

    if (docType) {
      docTypeString = "<!DOCTYPE " + docType.nodeName;
      if (docType.publicId) {
        docTypeString += " PUBLIC \"" + docType.publicId + "\"";
        if (docType.systemId) {
          docTypeString += " \"" + docType.systemId + "\"";
        }
      } else if (docType.systemId) {
        docTypeString += " SYSTEM \"" + docType.systemId + "\"";
      } if (docType.internalSubset) {
        docTypeString += " [" + docType.internalSubset + "]";
      }
      docTypeString += "> ";
    }
    return docTypeString + doc.documentElement.outerHTML;
}

async function getPageData(config, isInIframe) {
  postProcessDoc(config.doc)

  const url = parseURL(config.baseURI)

  let captureComponent = config.doc.getElementById('capture-main-component')

  if (captureComponent) {
    captureComponent.remove()

  }

  // if (this.options.insertSingleFileComment) {
  //
  //   const firstComment = this.doc.documentElement.firstChild
  //
  //   let infobarURL = this.options.saveUrl, infobarSaveDate = this.options.saveDate
  //   if (firstComment.nodeType == 8 && (firstComment.textContent.includes(util.COMMENT_HEADER_LEGACY) || firstComment.textContent.includes(util.COMMENT_HEADER))) {
  //     const info = this.doc.documentElement.firstChild.textContent.split('\n')
  //     try {
  //       const [, , url, saveDate] = info
  //       infobarURL = url.split('url: ')[1]
  //       infobarSaveDate = saveDate.split('saved date: ')[1]
  //       firstComment.remove()
  //     } catch (error) {
  //       // ignored
  //     }
  //   }
  //   const infobarContent = (this.options.infobarContent || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t')
  //   const commentNode = this.doc.createComment('\n ' + (this.options.useLegacyCommentHeader ? util.COMMENT_HEADER_LEGACY : util.COMMENT_HEADER) +
  //     ' \n url: ' + infobarURL +
  //     ' \n saved date: ' + infobarSaveDate +
  //     (infobarContent ? ' \n info: ' + infobarContent : '') + '\n')
  //   this.doc.documentElement.insertBefore(commentNode, this.doc.documentElement.firstChild)
  // }

  // if (this.options.insertCanonicalLink && this.options.saveUrl.match(ENUMS.HTTP_URI_PREFIX)) {
  //   let canonicalLink = this.doc.querySelector('link[rel=canonical]')
  //   if (!canonicalLink) {
  //     canonicalLink = this.doc.createElement('link')
  //     canonicalLink.setAttribute('rel', 'canonical')
  //     this.doc.head.appendChild(canonicalLink)
  //   }
  //   if (canonicalLink && !canonicalLink.href) {
  //     canonicalLink.href = this.options.saveUrl
  //   }
  // }

  if (config.insertMetaCSP) {
    const metaTag = config.doc.createElement('meta')
    metaTag.httpEquiv = 'content-security-policy'
    metaTag.content = 'default-src \'none\'; font-src \'self\' data:; img-src \'self\' data:; style-src \'unsafe-inline\'; media-src \'self\' data:; script-src * \'unsafe-inline\'; data:; '

    config.doc.head.appendChild(metaTag)
  }

  //Insert encoding meta tag
  const metaEncodingTag = config.doc.createElement('meta')
  metaEncodingTag.setAttribute('charset', 'utf-8')

  config.doc.head.appendChild(metaEncodingTag)


  // if (config.insertMetaNoIndex) {
  //   let metaElement = this.doc.querySelector('meta[name=robots][content*=noindex]')
  //   if (!metaElement) {
  //     metaElement = this.doc.createElement('meta')
  //     metaElement.setAttribute('name', 'robots')
  //     metaElement.setAttribute('content', 'noindex')
  //     this.doc.head.appendChild(metaElement)
  //   }
  // }

  const styleElement = config.doc.createElement('style')
  styleElement.textContent = 'img[src="data:,"],source[src="data:,"]{display:none!important}'
  config.doc.head.appendChild(styleElement)

  // let size
  // if (this.options.displayStats) {
  //   size = util.getContentSize(this.doc.documentElement.outerHTML)
  // }

  // const content = util.serialize(this.doc, this.options.compressHTML)

  let prefixLdID = window.config.frameId ? window.config.frameId : 'top'
  let allElems = config.doc.getElementsByTagName('*')

  for (let i = 0; i < allElems.length; i++) {
    let elem = allElems[i]

    elem.setAttribute('livedemo_id', `${prefixLdID}_${i}`)
  }




  // let content = htmlSerializer.process(config.doc, false)

  // let content = serializeDoc(config.doc)
  let content = (new XMLSerializer()).serializeToString(config.doc)

  // if(!isInIframe) {
    content = content.replace(/&lt;/g, '<')
    content = content.replace(/&gt;/g, '>')
    //   // content = content.replace(/&amp;/g, '&')
    //   // content = content.replace(/&quot;/g, '"')
    content = content.replace(/&nbsp;/g, '\u00a0')
  // }
  // //
  // } else {
  // //   content = content.replace(/&lt;/g, '<')
  // //   content = content.replace(/&gt;/g, '>')
  // //   content = content.replace(/&nbsp;/g, '\u00a0')
  // //
  // //   content = content.replace(/"/g, '&quot;')
  // }

    // content = content.replace(/&lt;/g, '<')
    // content = content.replace(/&gt;/g, '>')
    // content = content.replace(/&nbsp;/g, '\u00a0')
    //
    // content = content.replace(/"/g, '&quot;')

  // if (this.options.displayStats) {
  //   const contentSize = util.getContentSize(content)
  //   this.stats.set('processed', 'HTML bytes', contentSize)
  //   this.stats.add('discarded', 'HTML bytes', size - contentSize)
  // }

  // let filename = await ProcessorHelper.evalTemplate(this.options.filenameTemplate, this.options, content) || ''

  // const replacementCharacter = this.options.filenameReplacementCharacter
  // filename = util.getValidFilename(filename, this.options.filenameReplacedCharacters, replacementCharacter)
  // if (!this.options.backgroundSave) {
  //   filename = filename.replace(/\//g, replacementCharacter)
  // }

  // if (!this.options.saveToGDrive && !this.options.saveToGitHub && !this.options.saveWithCompanion &&
  //   ((this.options.filenameMaxLengthUnit == 'bytes' && util.getContentSize(filename) > this.options.filenameMaxLength) || (filename.length > this.options.filenameMaxLength))) {
  //
  //   const extensionMatch = filename.match(/(\.[^.]{3,4})$/)
  //
  //   const extension = extensionMatch && extensionMatch[0] && extensionMatch[0].length > 1 ? extensionMatch[0] : ''
  //
  //   filename = this.options.filenameMaxLengthUnit == 'bytes' ?
  //     await util.truncateText(filename, this.options.filenameMaxLength - extension.length) :
  //     filename.substring(0, this.options.filenameMaxLength - extension.length)
  //   filename = filename + '…' + extension
  //
  // }
  // if (!filename) {
  //   filename = 'Unnamed page'
  // }

  const matchTitle = config.baseURI.match(/([^/]*)\/?(\.html?.*)$/) || config.baseURI.match(/\/\/([^/]*)\/?$/)
  const pageData = {
    // stats: this.stats.data,
    title: config.title,
    // filename,
    content
  }
  // if (this.options.addProof) {
  //   pageData.hash = await util.digest('SHA-256', content)
  // }
  // if (this.options.retrieveLinks) {
  //
  //   pageData.links = Array.from(new Set(Array.from(this.doc.links).map(linkElement => linkElement.href)))
  // }

  return pageData
}

function removeDiscardedResources(config) {

  config.doc.querySelectorAll('.' + ENUMS.SINGLE_FILE_UI_ELEMENT_CLASS).forEach(element => element.remove())

  const noscriptPlaceholders = new Map()

  config.doc.querySelectorAll('noscript').forEach(noscriptElement => {

    const placeholderElement = config.doc.createElement('div')

    placeholderElement.innerHTML = noscriptElement.dataset.singleFileDisabledNoscript

    noscriptElement.replaceWith(placeholderElement)
    noscriptPlaceholders.set(placeholderElement, noscriptElement)
  })

  config.doc.querySelectorAll('meta[http-equiv=refresh], meta[disabled-http-equiv]').forEach(element => element.remove())
  Array.from(noscriptPlaceholders).forEach(([placeholderElement, noscriptElement]) => {

    noscriptElement.dataset.singleFileDisabledNoscript = placeholderElement.innerHTML
    placeholderElement.replaceWith(noscriptElement)
  })

  config.doc.querySelectorAll('meta[http-equiv="content-security-policy"]').forEach(element => element.remove())

  const objectElements = config.doc.querySelectorAll('applet, object[data]:not([type="image/svg+xml"]):not([type="image/svg-xml"]):not([type="text/html"]), embed[src]:not([src*=".svg"]):not([src*=".pdf"])')

  objectElements.forEach(element => element.remove())

  const replacedAttributeValue = config.doc.querySelectorAll('link[rel~=preconnect], link[rel~=prerender], link[rel~=dns-prefetch], link[rel~=preload], link[rel~=manifest], link[rel~=prefetch]')

  replacedAttributeValue.forEach(element => {
    const relValue = element.getAttribute('rel').replace(/(preconnect|prerender|dns-prefetch|preload|prefetch|manifest)/g, '').trim()
    if (relValue.length) {

      element.setAttribute('rel', relValue)
    } else {
      element.remove()
    }
  })

  config.doc.querySelectorAll('link[rel*=stylesheet][rel*=alternate][title],link[rel*=stylesheet]:not([href]),link[rel*=stylesheet][href=""]').forEach(element => element.remove())
  if (config.removeHiddenElements) {

    config.doc.querySelectorAll('input[type=hidden]').forEach(element => element.remove())
  }
  if (!config.saveFavicon) {

    config.doc.querySelectorAll('link[rel*="icon"]').forEach(element => element.remove())
  }

  config.doc.querySelectorAll('a[ping]').forEach(element => element.removeAttribute('ping'))
  config.doc.querySelectorAll('link[rel=import][href]').forEach(element => element.remove())
}


function checkIfAllFramesFinished(frames) {

  return Object.values(frames).every(frameObj => frameObj.finished)
}

function rewriteFrames(config) {
  if(config.allFrames) {

    Object.entries(config.allFrames).forEach(([key, value]) => {

      let content = value.content.content
      // content = content.replace(/&/g, '&amp;amp;')
      // content = content.replace(/"/g, '&quot;')
      config.doc.querySelectorAll(`[data-ld-id="${key}"]`).forEach(frameElement => {
        frameElement.removeAttribute('data-ld-id')

        if (frameElement.tagName === 'OBJECT') {

          frameElement.setAttribute('data', 'data:text/html,' + content)
        } else {
          if (frameElement.tagName === 'FRAME') {

            frameElement.setAttribute('src', 'data:text/html,' + content.replace(/%/g, '%25').replace(/#/g, '%23'))
          } else {

              // content = content.replace(/&lt;/g, '<')
              // content = content.replace(/&gt;/g, '>')
              // content = content.replace(/&nbsp;/g, '\u00a0')

              // content = content.replace(/"/g, '&quot;')
              // content = content.replace(/&/g, '&amp;')

            frameElement.setAttribute('srcdoc', content)
            frameElement.removeAttribute('src')
          }
        }
      })
    })
  }


}

function removeATagHrefs() {
  config.doc.querySelectorAll('a').forEach(aTagElement => {

    if (aTagElement.hasAttribute('href')) {

      let currentHrefLink = aTagElement.getAttribute('href')
      aTagElement.setAttribute('ld_href', currentHrefLink)
      aTagElement.setAttribute('href', 'javascript:void(0);')
    }
  })
}

function disableForms() {
  config.doc.querySelectorAll('form').forEach(formElement => {

      let currentFormElemOnSubmit = formElement.getAttribute('href')
      formElement.setAttribute('ld_onsubmit', currentFormElemOnSubmit)
      formElement.setAttribute('onSubmit', 'return false;')
  })
}

function insertVideoPosters(config) {
  if (config.posters) {

    config.doc.querySelectorAll('video, video[src], video > source[src]').forEach(element => {
      let videoElement
      if (element.tagName === 'VIDEO') {
        videoElement = element
      } else {
        videoElement = element.parentElement
      }
      const attributeValue = element.getAttribute(ENUMS.POSTER_ATTRIBUTE_NAME)
      if (attributeValue) {
        const posterURL = config.posters[Number(attributeValue)]
        if (!videoElement.poster && posterURL) {
          videoElement.setAttribute('poster', posterURL)
        }
      }
    })
  }
}

function replaceCanvasElements(config) {
  if (config.canvases) {
    config.doc.querySelectorAll('canvas').forEach(canvasElement => {

      const attributeValue = canvasElement.getAttribute(ENUMS.CANVAS_ATTRIBUTE_NAME)

      if (attributeValue) {

        const canvasData = config.canvases[Number(attributeValue)]

        if (canvasData) {

          canvasSetBackgroundImage(canvasElement, 'url(' + canvasData.dataURI + ')')
          // config.stats.add('processed', 'canvas', 1)
        }
      }
    })
  }
}


function canvasSetBackgroundImage(element, url, style) {
  element.style.setProperty('background-blend-mode', 'normal', 'important')
  element.style.setProperty('background-clip', 'content-box', 'important')
  element.style.setProperty('background-position', style && style['background-position'] ? style['background-position'] : 'center', 'important')
  element.style.setProperty('background-color', style && style['background-color'] ? style['background-color'] : 'transparent', 'important')
  element.style.setProperty('background-image', url, 'important')
  element.style.setProperty('background-size', style && style['background-size'] ? style['background-size'] : '100% 100%', 'important')
  element.style.setProperty('background-origin', 'content-box', 'important')
  element.style.setProperty('background-repeat', 'no-repeat', 'important')
}

export default {
  disableForms,
  addStylesheetToStylesheets,
  insertVariables,
  getAllContent,
  insertVideoPosters,
  replaceCanvasElements,
  rewriteFrames,
  checkIfAllFramesFinished,
  removeDiscardedResources,
  preProcessPage,
  getPageData,
  cleanupPage,
  removeATagHrefs,
  replaceStylesheets,
  replaceStyleAttributes,
  processScripts,
  preProcessDoc,
  resolveStylesheetURLs,
  processStylesheets,
  resolveStyleAttributeURLs,
  processStyleAttributes,
  processPageResources
}
