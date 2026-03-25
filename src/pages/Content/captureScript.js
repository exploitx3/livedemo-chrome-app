/* eslint-disable import/default */

import React, { useState } from 'react'
import * as ReactDOM from 'react-dom'
import CaptureComponent from './CaptureComponent/CaptureComponent'



function setupComponent() {

  let mainTag = document.createElement('div')
  mainTag.id = 'capture-main-component'

  // window.addEventListener('load', function() {
  document.getElementsByTagName('body')[0].appendChild(mainTag)


  ReactDOM.render((
    <div>
      <CaptureComponent/>
    </div>
  ), mainTag)
  // })

}

setupComponent()
