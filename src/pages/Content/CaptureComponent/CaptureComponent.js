/* eslint-disable import/default */

import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import mainColors from '../../../constants/mainColors'
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons'
import { CircularProgressbar } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'
// import 'antd/dist/antd.css'



const CaptureComponent = function () {
  let [isCapturing, setIsCapturing] = useState(false)
  let [hasCaptured, setHasCaptured] = useState(false)
  let [progressValue, setProgressValue] = useState(1)
  let [timer, setTimer] = useState(null)

  function handleCaptureEvents(event) {
    if (event.data.type === 'CaptureComponent-captureStarted') {

      onCapture()
    }

    if (event.data.type === 'updateProgress') {


      setProgressValue(progressValue + event.data.value)
    }

    if (event.data.type === 'captureFinished') {



      setIsCapturing(false)
      setHasCaptured(true)

      if(window.captureTimer){
        clearInterval(window.captureTimer)
      }


      setTimeout(() => {
        setHasCaptured(false)
        setProgressValue(1)
      }, 1500)

      // console.log('Capturing finished')
      // console.log(event.data)
    }
  }

  useEffect(function() {
    // console.log('useEffect called')
    window.addEventListener('message', handleCaptureEvents)

    //
    // chrome.runtime.onMessage.addListener((msgObj, msgCommander, sendResponse) => {
    //
    //
    //   if (msgObj.type === 'capturePageFromCaptureComponent') {
    //     console.log(msgObj)
    //     // window.postMessage({
    //     //   type: 'capture',
    //     // })
    //
    //   }
    // })

  }, [])


  function onCapture() {
    setIsCapturing(true)


    window.captureTimer = setInterval(function () {


      setProgressValue((prevTime) => {

        let newTime = prevTime + 3

        if (newTime > 100 || hasCaptured) {
          clearInterval(timer)
        }

        return newTime
      })


    }, 1000)

    setTimer(() => {

      window.postMessage({
        type: 'capture'
      })

      setTimeout(() => {
        setIsCapturing(false)
        // console.log('Capturing timed-out')

      }, 60 * 1000)

      return timer
    })

  }

  // const [stepIndex, setStepIndex] = useState(0)
  // const [run, setRun] = useState(true)



  function removeCaptureComponent() {

    let element = document.getElementById('capture-main-component')
    element.remove()
  }

  return (<CC.Wrapper className="capture-storydemo-wrapper">


      <CC.PanelWrapper>
        <CC.Panel>
          <CC.ButtonWrapper>
            <CC.CloseButton onClick={() => {

              removeCaptureComponent()
            }} className={'CloseButton'}>
              <CC.CloseIcon/>
            </CC.CloseButton>
            {isCapturing ? (
              <div style={{ width: 50, height: 50 }}>
                <CC.ProgressBar value={progressValue}/>
              </div>
            ) : (
              <React.Fragment>
              {
                hasCaptured ? (
                <CC.DoneWrapper>
                  <CC.CaptureDoneIcon/>
                  <CC.DoneText>Done</CC.DoneText>
                </CC.DoneWrapper>
              ) : (
                  <CC.ButtonInnerWrapper>

                    <CC.CaptureButton type={'primary'}
                                  disabled={isCapturing}
                                  loading={isCapturing}
                                  onClick={() => {
                                    onCapture()
                                  }}>
                  Capture</CC.CaptureButton>
                    <CC.ShortcutText>
                      or Alt+S
                    </CC.ShortcutText>
                  </CC.ButtonInnerWrapper>

                )
              }
              </React.Fragment>
            )
            }
          </CC.ButtonWrapper>

        </CC.Panel>
      </CC.PanelWrapper>
    </CC.Wrapper>
  )
}

const CC = {
  ProgressBar: styled(CircularProgressbar)`

    .CircularProgressbar-trail {
      stroke: #041a3a;
    }
    
    .CircularProgressbar-path {
      stroke: #fff;
    }
  `,
  DoneWrapper: styled.div`
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
`,
  DoneText: styled.span`
    margin: 0px;
    color: white !important;
    margin-left: 10px;
    font-family: ${mainColors.fontFamily} !important;;
    font-size: 1.3em;
  `,
  PanelWrapper: styled.div`
    height: 100px;
    //background: ${mainColors.primaryColor};
    //transition: height .2s,bottom .2s;
    width: 100%;
    display: flex;
    align-items: flex-end;
    &&:hover {
     
      .CloseButton {
        display: block;
      }
    }
  `,
  Panel: styled.div`
    height: 60px;
    background: ${mainColors.primaryColor};
    transition: height .2s,bottom .2s;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    border-top: 2px solid white;
    
   
  `,
  CaptureDoneIcon: styled(CheckCircleFilled)`
    width: 38px;
    height: 38px;
    
    && svg {
      fill: #FFF !important;;
      width: 100%;
      height: 100%;
    }
  `,
  CloseButton: styled.div`
    position: absolute;
    top: -28px;
    right: -20px;
    
    display: none;
    
    &&:hover {
      cursor: pointer;
    }
    
    
    
  `,
  CloseIcon: styled(CloseCircleFilled)`
    width: 22px;
    height: 22px;
    border: 2px solid #1070ff;
    border-radius: 50%;
    background: #1070ff;
    
    && svg {
      fill: #FFFFFF;
      width: 100%;
      height: 100%;
    }
  `,
  Wrapper: styled.div`
    border: none;
    z-index: 2147483647;
    padding: 0px;
    position: fixed;
    //right: 0px;
    //left: calc(50% - 180px);
    max-height: 100vh;
    //height: 100%;
    width: 100%;
    margin: 0px;
    color-scheme: light dark;
    visibility: visible !important;
    bottom: 0px;
    //background: rgba(16,112,255,0.25);

    display: flex !important;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    
    
  `,
  ButtonWrapper: styled.div`
    position: relative;
    width: 180px;
    height: 60px;
    border-radius: 20px;
    //background: #F9F9F9;
    //border: 1px solid #F9F9F9;
    flex-direction: column;
    display: flex;
    justify-content: center;
    align-items: center;
    //opacity: 0.75;
    //
    //&&:hover {
    //  opacity: 1;
    // 
    //}
  `,
  ButtonInnerWrapper: styled.div`
    position: relative;
    flex-direction: row;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 300px;
  `,
  ShortcutText: styled.div`
    position: relative;
    //background: #F9F9F9;
    //border: 1px solid #F9F9F9;
    font-family: ${mainColors.fontFamily} !important;;
    color: white !important;
    font-size: 1.3em;
    margin-left: 15px;
    font-weight: 500;
  `,
  CaptureButton: styled.button`
    background: #F9F9F9 !important;;
    width: 100px;
    height: 40px;
    color: ${mainColors.primaryText} !important;;
    border-radius: 4px;
    //border: 0px;
    border: 1px solid #F9F9F9;

     &&:hover {
      cursor: pointer;
    }
    
    
  `
}

export default CaptureComponent
