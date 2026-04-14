import React, { Suspense } from 'react'
import { RecoilRoot, useRecoilTransactionObserver_UNSTABLE } from 'recoil'
import { render } from 'react-dom'
import * as state from './state'
import Popup from './Popup'
import './index.css'
import { MemoryRouter as Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import * as Sentry from '@sentry/browser'
import ENV from '../../config.json'

Sentry.init({
  dsn: ENV.SENTRY_DSN,
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true
});



function setItem(key, value) {

  return localStorage.setItem(key, value)
}

function removeItem(key) {
  return localStorage.remove(key)
}

function getItem(key) {
  let newItem = localStorage.getItem(key)


  return newItem
}

function getItemFromStorage(key) {

  return chrome.storage.local.get(key).then(r => {
    return r[key]
  })
}

function setItemInStorage(key, value) {

  return chrome.storage.local.set({ [key]: value }).then(() => {
    return true
  })
}

const history = createMemoryHistory()

const initialStore = {
  authData: {},
  isRecording: false,
  previousLocation: '/new-demo',
  isNameChosen: false,
  newDemoName: null,
  userWorkspaces: null,
  currentSelectedWorkspace: null,
  extensionActionOnToolbar: null,
}

async function initializeState({ set }) {

  let authDataFromStorage = await getItemFromStorage('authData')

  let storedState = JSON.parse(localStorage.getItem('recoilState'))
  console.log('initializeState - storedState')
  console.log(storedState)

  if(!storedState) {
    storedState = initialStore


    localStorage.setItem('recoilState', JSON.stringify(storedState))
  }

  if(storedState && !storedState.authData) {
    if(authDataFromStorage) {
      storedState.authData = authDataFromStorage
    }

    localStorage.setItem('recoilState', JSON.stringify(storedState))
  }

  let toolbarCached = await getItemFromStorage(state.EXTENSION_ACTION_ON_TOOLBAR_STORAGE_KEY)
  if (toolbarCached !== true && toolbarCached !== false && storedState.extensionActionOnToolbar != null) {
    toolbarCached = storedState.extensionActionOnToolbar
  }

  set(state.authDataState, authDataFromStorage ? authDataFromStorage : storedState.authData)
  set(state.isRecordingState, storedState.isRecording)
  set(state.previousLocationState, storedState.previousLocation ? storedState.previousLocation : initialStore.previousLocation)
  set(state.isNameChosenState, storedState.isNameChosen)
  set(state.newDemoNameState, storedState.newDemoName)
  set(state.userWorkspaces, storedState.userWorkspaces)
  set(state.currentSelectedWorkspace, storedState.currentSelectedWorkspace)
  set(
    state.extensionActionOnToolbarState,
    toolbarCached === true ? true : toolbarCached === false ? false : null
  )

  const initialAuth = authDataFromStorage ? authDataFromStorage : storedState.authData
  if (initialAuth && initialAuth.token) {
    chrome.storage.local.set({ authData: initialAuth })
  }
}

function DebugObserver() {
  useRecoilTransactionObserver_UNSTABLE(({ snapshot }) => {
    let authData = snapshot.getLoadable(state.authDataState).contents
    let isRecording = snapshot.getLoadable(state.isRecordingState).contents
    let previousLocation = snapshot.getLoadable(state.previousLocationState).contents
    let isNameChosen = snapshot.getLoadable(state.isNameChosenState).contents
    let newDemoName = snapshot.getLoadable(state.newDemoNameState).contents
    let userWorkspaces = snapshot.getLoadable(state.userWorkspaces).contents
    let currentSelectedWorkspace = snapshot.getLoadable(state.currentSelectedWorkspace).contents
    let extensionActionOnToolbar = snapshot.getLoadable(state.extensionActionOnToolbarState).contents

    localStorage.setItem('recoilState', JSON.stringify({
      authData,
      isRecording,
      previousLocation,
      isNameChosen,
      newDemoName,
      userWorkspaces,
      currentSelectedWorkspace,
      extensionActionOnToolbar,
    }))

    if (extensionActionOnToolbar === true || extensionActionOnToolbar === false) {
      chrome.storage.local.set({
        [state.EXTENSION_ACTION_ON_TOOLBAR_STORAGE_KEY]: extensionActionOnToolbar,
      })
    }

    if (authData && authData.token) {
      chrome.storage.local.set({ authData })
    }

  })

  return null
}

console.log('Popup js loaded')

render(
  <Router history={history}>
    <RecoilRoot initializeState={initializeState}>
      <DebugObserver/>
      <Suspense fallback={<div>Loading whale types...</div>}>

        <Popup/>
      </Suspense>
    </RecoilRoot>
  </Router>,
  window.document.querySelector('#app-container'))

if (module.hot) module.hot.accept();
