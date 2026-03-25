import React from 'react'

export function SwitchComponentIfAuth({ NonAuthComponent, AuthComponent, authData }) {

  console.log('SwitchComponentIfAuth')
  console.log(authData)

  // useEffect(() => {
  //     //   if (authDataState && authDataState.authData && authDataState.authData.name) {
  //     setText('authenticated')
  //   } else {
  //     setText('unauthenticated')
  //   }
  // }, [])

  function getComponentToRender(authData) {


    if (authData && authData.name) {
      if (typeof AuthComponent === 'function') {
        return (<AuthComponent/>)
      } else {
        return AuthComponent
      }
    } else {
      if (typeof NonAuthComponent === 'function') {
        return (<NonAuthComponent/>)
      } else {
        return NonAuthComponent
      }
    }
  }


  // let ComponentToRender = getComponentToRender(authDataState)

  return getComponentToRender(authData)

  // return (
  //   <React.Fragment>
  //     <ComponentToRender/>
  //   </React.Fragment>
  // )
}


export function SwitchComponentIfRecording({ NonRecordingComponent, RecordingComponent, isRecording }) {

  function getComponentToRender(isRecording) {


    if (isRecording) {
      if (typeof RecordingComponent === 'function') {
        return (<RecordingComponent/>)
      } else {
        return RecordingComponent
      }
    } else {
      if (typeof NonRecordingComponent === 'function') {
        return (<NonRecordingComponent/>)
      } else {
        return NonRecordingComponent
      }
    }
  }


  // let ComponentToRender = getComponentToRender(authDataState)

  return getComponentToRender(isRecording)

  // return (
  //   <React.Fragment>
  //     <ComponentToRender/>
  //   </React.Fragment>
  // )
}


