/* eslint-disable import/default */

import React from 'react'
import * as ReactDOM from 'react-dom'
import CountdownComponent from './CountdownComponent/CountdownComponent'


function takeScreenshot() {


  return new Promise((resolve ,reject) => {
    let element = document.getElementById('takeScreenshot-main-component')
    element.remove()

    setTimeout(() => {
      window.postMessage({ type: 'ld-screenshot-request' })
    }, 500)


    resolve()
  })

}

function setupComponent() {

  let mainTag = document.createElement('div')
  mainTag.id = 'takeScreenshot-main-component'
  mainTag.style = ' z-index: 999999999999;\n    position: fixed;\n    height: 100vh;\n    width: 100vw; top: 0;'

  document.getElementsByTagName('body')[0].appendChild(mainTag)


  ReactDOM.render((
    <CountdownComponent onFinish={takeScreenshot}/>
  ), mainTag)
  // })

}

setupComponent()
