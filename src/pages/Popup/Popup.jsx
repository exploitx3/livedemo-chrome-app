/*global chrome*/

import React, { useEffect, useState } from 'react'
import '../../containers/Greetings/Greetings'
import './Popup.css'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
// noinspection ES6UnusedImports
import Greetings from '../../containers/Greetings/Greetings'
import LoginPage from './pages/Login/Login'
import CreateNewLiveDemo from './pages/CreateNewLiveDemo/CreateNewLiveDemo'
import CreateNewFlixDemo from './pages/CreateNewFlixDemo/CreateNewFlixDemo'
import CreateNewStoryDemo from './pages/CreateNewStoryDemo/CreateNewStoryDemo'
import CreateNewDemo from './pages/CreateNewDemo/CreateNewDemo'
import StoryPage from './pages/StoryPage/StoryPage'
import DashboardPage from './pages/Dashboard/Dashboard'
import { SwitchComponentIfAuth } from './components/HOCs/HOCs'
import PinReminderFooter from './components/PinReminderFooter/PinReminderFooter'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import * as state from './state'
import "antd/dist/antd.css"

async function getTab() {

  return new Promise(function (resolve, reject) {

    chrome.windows.getCurrent(w => {
      chrome.tabs.query({ active: true, windowId: w.id }, tabs => {


        resolve(tabs[0])
      })
    })
  })


}

const Popup = () => {

  let authData = useRecoilValue(state.authDataState)
  const [previousLocation, setPreviousLocation] = useRecoilState(state.previousLocationState)
  const [backLocation, setBackLocation] = useRecoilState(state.backLocationState)
  const [alreadyNavigateToPreviousLocation, setAlreadyNavigateToPreviousLocation] = useState(false)

  const [tabInfo, setTabInfo] = useRecoilState(state.tabInfo)

  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    console.log('checkContentScript called')
    checkContentScript()
  }, [])

  useEffect(() => {
console.log('pathname')
console.log(pathname)
    if(alreadyNavigateToPreviousLocation) {

      setBackLocation(previousLocation)
      setPreviousLocation(pathname)
    }
  }, [pathname])

  useEffect(() => {

console.log('previousLocation in useeffect')
console.log(previousLocation)
    if (!alreadyNavigateToPreviousLocation && previousLocation) {

      setAlreadyNavigateToPreviousLocation(true)
    }

  }, [previousLocation])


  function checkContentScript() {

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'flixCheckContentScript',
      }, function (response) {


        if(response && response.tabInfo) {
          setTabInfo(response.tabInfo)
        }

        let err = chrome.runtime.lastError
        if (err) {
          console.log(err.message)
        }

        console.log('flix_checkContentScript ' + JSON.stringify(response))

        resolve(response)
      })
    })


  }

  console.log('Popup - authData')
  console.log(authData)


  console.log('previousLocation')
  console.log(previousLocation)
  return (
    <div className="App App--column">
      <div className="App-body">
      {!alreadyNavigateToPreviousLocation && !(authData && authData.name) ? (
        <LoginPage/>
      ) : (
        <Routes>
          <Route path="/" element={<Navigate replace
                                             to={previousLocation === '/' || !previousLocation ? '/new-demo' : previousLocation}/>}/>
          <Route exact path="/login"
                 element={
                   <SwitchComponentIfAuth NonAuthComponent={LoginPage} AuthComponent={CreateNewFlixDemo}
                                          authData={authData}/>
                 }
          />
          /* This is being used as demo creation page*/
          <Route exact path='/new-demo' element={
            <SwitchComponentIfAuth NonAuthComponent={LoginPage} AuthComponent={CreateNewFlixDemo}
                                   authData={authData}/>
          }
          />

          <Route exact path='/story/:storyId' element={
            <SwitchComponentIfAuth NonAuthComponent={LoginPage} AuthComponent={StoryPage}
                                   authData={authData}/>
          }
          />
          <Route exact path="/dashboard/livedemos"
                 element={
                   <SwitchComponentIfAuth
                     NonAuthComponent={LoginPage}
                     AuthComponent={<DashboardPage view={'livedemos'}/>}
                     authData={authData}/>
                 }
          />
          <Route exact path="/dashboard/videos"
                 element={
                   <SwitchComponentIfAuth
                     NonAuthComponent={LoginPage}
                     AuthComponent={<DashboardPage view={'videos'} />}
                     authData={authData}/>
                 }
          />
          <Route exact path="/dashboard/images"
                 element={
                   <SwitchComponentIfAuth
                     NonAuthComponent={LoginPage}
                     AuthComponent={<DashboardPage view={'images'}/>}
                     authData={authData}/>
                 }
          />

          {/*<Route path="*" element={}/>*/}
          {/*</Route>*/}

          <Route path='*'
                 element={
                   <SwitchComponentIfAuth NonAuthComponent={LoginPage} AuthComponent={DashboardPage}
                                          authData={authData}/>
                 }
          />


        </Routes>
      )}
      </div>
      <PinReminderFooter />
    </div>
  );
};

export default Popup;
