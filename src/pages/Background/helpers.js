const ENV = require('../../config.json')

export function hash(text) {
  'use strict'
  let hash = 5381,
    index = text.length
  while (index) {
    hash = (hash * 33) ^ text.charCodeAt(--index)
  }
  return hash >>> 0
}

export function shortHash(str) {
  return hash(str).toString(16)
}

export function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf))
}

export function str2ab(str) {
  var buf = new ArrayBuffer(str.length * 2) // 2 bytes for each char
  var bufView = new Uint16Array(buf)
  for (var i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}


export function cleanStorage() {
  return chrome.storage.local.clear()
}


export function base64ToArrayBuffer(base64) {
  var binary_string = window.atob(base64)
  var len = binary_string.length
  var bytes = new Uint8Array(len)
  for (var i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i)
  }
  return bytes.buffer
}

export function arrayBufferToBase64(buffer) {
  var binary = ''
  var bytes = new Uint16Array(buffer)
  var len = bytes.byteLength
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return Buffer.from(binary).toString('base64')
}

export function getImage() {


  return new Promise((resolve, reject) => {

    return chrome.windows.getCurrent()
      .then(w => {

        return chrome.tabs.captureVisibleTab(w.id, { format: 'png', quality: 50 }, function (data) {

          resolve(data)
        })
      })
  })
}


export function takeScreenshotAndSend(storyId, workspaceId, authToken) {

  chrome.action.setIcon({ path: 'logo-recording-128.png' })

  return new Promise((resolve, reject) => {

    chrome.tabs.captureVisibleTab(undefined, { format: 'png' },
      image => {

        console.log(image)
        console.log('Took screenshot')

        let body = {
          base64Screenshot: image
        }

        if (storyId) {
          body.storyId = storyId
        }

        return fetch(`${ENV.STORIES_API}/workspaces/${workspaceId}/library/uploadScreenshot`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        })
          .then(() => {

            chrome.action.setIcon({ path: 'logo-128.png' })
            resolve()
          })


      }
    )
  })

}
