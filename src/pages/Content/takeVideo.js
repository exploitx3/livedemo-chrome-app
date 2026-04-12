/* eslint-disable import/default */

import React from 'react'
import * as ReactDOM from 'react-dom'
import CountdownComponent from './CountdownComponent/CountdownComponent'

/**
 * Injected into the page via injectScript('takeVideo.bundle.js').
 * Cursor install/remove runs in the content-script world (topScript / flixHelpers)
 * via window.postMessage — see {@link ld-take-video-install-cursor}.
 */

function onCountdownFinish() {
  return new Promise((resolve) => {
    const el = document.getElementById('takeVideo-main-component')
    if (el) {
      el.remove()
    }

    setTimeout(() => {
      window.postMessage({ type: 'ld-video-request' })
      
    }, 500)

    resolve()
  })
}

function setupComponent() {
  const mainTag = document.createElement('div')
  mainTag.id = 'takeVideo-main-component'
  mainTag.style = ' z-index: 999999999999;\n    position: fixed;\n    height: 100vh;\n    width: 100vw; top: 0;'

  document.getElementsByTagName('body')[0].appendChild(mainTag)

  setTimeout(() => {
    window.postMessage({ type: 'ld-take-video-install-cursor' })
  }, 1200)

  ReactDOM.render((
    <CountdownComponent onFinish={onCountdownFinish}/>
  ), mainTag)
}

setupComponent()
