/* eslint-disable import/default */

import React from 'react'
import * as ReactDOM from 'react-dom'
import CountdownComponent from './CountdownComponent/CountdownComponent'


function takeManualRecording() {


  return new Promise((resolve, reject) => {
    document.getElementById('takeManualRecording-main-component')?.remove()

    setTimeout(() => {
      window.postMessage(
        {
          type: 'flix_startRecording',
        },
        '*'
      )
    }, 500)


    resolve()
  })

}

function setupComponent() {

  let mainTag = document.createElement('div')
  mainTag.id = 'takeManualRecording-main-component'
  mainTag.style = ' z-index: 999999999999;\n    position: fixed;\n    height: 100vh;\n    width: 100vw; top: 0;'

  document.getElementsByTagName('body')[0].appendChild(mainTag)


  ReactDOM.render((
    <CountdownComponent onFinish={takeManualRecording} />
  ), mainTag)
  // })

}

setupComponent()
