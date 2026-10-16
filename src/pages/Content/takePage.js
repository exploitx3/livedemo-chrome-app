/* eslint-disable import/default */

import React from 'react'
import * as ReactDOM from 'react-dom'
import CountdownComponent from './CountdownComponent/CountdownComponent'

const { record } = require('@rrweb/record')

const RRWEB_META = 4
const RRWEB_FULL_SNAPSHOT = 2

function captureBaseEvents() {
  return new Promise((resolve, reject) => {
    const events = []
    let stopFn = null
    let settled = false

    const finish = (result, error) => {
      if (settled) {
        return
      }
      settled = true
      if (typeof stopFn === 'function') {
        try {
          stopFn()
        } catch (e) {
          // ignore
        }
        stopFn = null
      }
      if (error) {
        reject(error)
        return
      }
      resolve(result)
    }

    const timeoutId = setTimeout(() => {
      finish(null, new Error('rrweb FullSnapshot timed out'))
    }, 15000)

    stopFn = record({
      emit(event) {
        events.push(event)
        const hasMeta = events.some((e) => e && e.type === RRWEB_META)
        const hasFull = events.some((e) => e && e.type === RRWEB_FULL_SNAPSHOT)
        if (hasMeta && hasFull) {
          clearTimeout(timeoutId)
          // Keep Meta + FullSnapshot only — one-shot Base screen.
          const baseEvents = events.filter(
            (e) => e && (e.type === RRWEB_META || e.type === RRWEB_FULL_SNAPSHOT)
          )
          finish(baseEvents)
        }
      },
      inlineStylesheet: true,
      collectFonts: true,
      recordCanvas: false,
      recordCrossOriginIframes: false,
      maskAllInputs: false,
      slimDOMOptions: 'all',
    })
  })
}

function takePage() {
  return new Promise((resolve, reject) => {
    const element = document.getElementById('takePage-main-component')
    if (element) {
      element.remove()
    }

    setTimeout(() => {
      captureBaseEvents()
        .then((events) => {
          window.postMessage({
            type: 'ld-page-request',
            events,
            width: window.innerWidth,
            height: window.innerHeight,
            name: (document.title || '').trim() || 'Base',
          })
          resolve()
        })
        .catch((err) => {
          console.error('takePage capture failed', err)
          reject(err)
        })
    }, 500)
  })
}

function setupComponent() {
  const mainTag = document.createElement('div')
  mainTag.id = 'takePage-main-component'
  mainTag.style = ' z-index: 999999999999;\n    position: fixed;\n    height: 100vh;\n    width: 100vw; top: 0;'

  document.getElementsByTagName('body')[0].appendChild(mainTag)

  ReactDOM.render((
    <CountdownComponent onFinish={takePage}/>
  ), mainTag)
}

setupComponent()
