import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import Colors from '../../../../constants/mainColors'
import { BarsOutlined, LeftCircleOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
import IconTextButton from '../../components/IconTextButton/IconTextButton'
import Header from '../../components/Header/Header'
import Spinner from '../../components/Spinner/Spinner'
import ScreensList from './components/ScreensList/ScreensList'
import { useNavigate, useParams } from 'react-router-dom'
import { useRecoilState, useRecoilValue } from 'recoil'
import * as state from '../../state'
import { Icon, Input } from 'antd'
import axios from '../../../../helpers/axiosInstance'
import * as ENV from '../../../../config.json'

const CAPTURE_TYPE = {
  // page: 'page',
  screenshot: 'screenshot',
  video: 'video'
}
const StoryPage = function (props) {
  let navigate = useNavigate()

  let { storyId } = useParams()

  const [previousLocation, setPreviousLocation] = useRecoilState(state.previousLocationState)
  const [backLocation, setBackLocation] = useRecoilState(state.backLocationState)

  const [authData, setAuthData] = useRecoilState(state.authDataState)
  const currentSelectedWorkspace = useRecoilValue(state.currentSelectedWorkspace)
  const [sessionRecordingId, setSessionRecordingId] = useRecoilState(state.sessionRecordingIdState)
  const [isNameChosen, setIsNameChosen] = useRecoilState(state.isNameChosenState)
  const [newDemoName, setNewDemoName] = useRecoilState(state.newDemoNameState)

  const [story, setStory] = useState({})
  const [isStoryLoading, setIsStoryLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRecording, setIsRecording] = useRecoilState(state.isRecordingState)

  const [selectedCaptureType, setSelectedCaptureType] = useState(CAPTURE_TYPE.page)

  function getStory(workspaceId, storyId, authToken) {

    setIsStoryLoading(true)

    return axios.get(`${ENV.STORIES_API}/workspaces/${workspaceId}/stories/${storyId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        }
      })
      .then((res) => {

        setStory(res.data)
        setIsStoryLoading(false)

        return res.data
      })
  }

  useEffect(() => {

    getStory(currentSelectedWorkspace._id, storyId, authData.token)

  }, [])

  useEffect(() => {
    if (isRecording) {

      stopRecording()
    } else {


      chrome.action.setIcon({ path: 'logo-128.png' })
    }

    checkRecording()
      .then((isRecordingBg) => {

        console.log('isRecording - ')
        console.log(isRecordingBg)

        if (isRecordingBg !== null) {

          setIsRecording(isRecordingBg)
        }

        // If it is recording immediately stop recording and save livedemo
        setIsRecording(isRecordingBg)

        if(!isRecordingBg && !isRecording) {
          setIsSaving(false)
        }
      })
    return () => {

    }
  }, [])


  function stopRecording() {

    setIsSaving(true)

    chrome.action.setIcon({ path: 'logo-128.png' })
    setIsRecording(false)


    return new Promise((resolve, reject) => {

      chrome.runtime.sendMessage({
        type: 'flix_stopRecording',
        demoData: {
          workspaceId: currentSelectedWorkspace._id,
        },
        // authData: authData,
      }, (res) => {

        // let newStoryDemo = res.storyDemo
        // setIsSaving(false)
        // resolve(res)

        setTimeout(() => {


          setIsSaving(false)

          resolve(res)

        }, 15000)

      })

    })
      .then(() => {

        getStory(currentSelectedWorkspace._id, storyId, authData.token)
      })


  }

  function checkRecording() {

    return new Promise((resolve, reject) => {


      chrome.runtime.sendMessage({
        type: 'flixCheckRecording',
      }, function (response) {

        let err = chrome.runtime.lastError
        if (err) {
          console.log(err.message)
        }

        console.log('flixCheckRecording ' + JSON.stringify(response))
        resolve(response && response.IsAttached)
      })
    })

  }

  async function capture(workspaceId, storyId, token) {
    setIsNameChosen(true)


    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {

      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'getStarted',
        workspaceId: workspaceId,
        storyId: storyId,
        authToken: token,
      }, function (response) {


        console.log('capture message sent')
      })


    })


  }

  /*
  if (screen.type === 'Screen_Page') {

      return <SC.ScreenIcon>
        <svg className="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium MuiBox-root css-1om0hkc" focusable="false"
             aria-hidden="true" viewBox="0 0 24 24" data-testid="WebIcon">
          <path
            d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z"></path>
        </svg>
      </SC.ScreenIcon>
    } else if (screen.type === 'Screen_Screenshot') {

      return <SC.ScreenIcon>
        <Icon type={'picture'}/>
      </SC.ScreenIcon>
    } else if (screen.type === 'Screen_Video') {

      return <SC.ScreenIcon>
        <Icon type={'video-camera'}/>
      </SC.ScreenIcon>
    }
    */

  function getCaptureImage(captureType) {
    if (captureType === CAPTURE_TYPE.page) {

      return (<svg className="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium MuiBox-root css-1om0hkc" focusable="false"
             aria-hidden="true" viewBox="2 2 20 20" data-testid="WebIcon">
          <path
            d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z"></path>
        </svg>
      )

    } else if (captureType === CAPTURE_TYPE.screenshot) {

      return <Icon type={'picture'}/>
    } else if (captureType === CAPTURE_TYPE.video) {

      return <Icon type={'video-camera'}/>
    }
  }


  function getCaptureOnClick(captureType, story, authData) {
    if(captureType === CAPTURE_TYPE.page) {

      capture(story.workspaceId, story._id, authData.token)
      window.close()

    } else if(captureType === CAPTURE_TYPE.screenshot) {

      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {


        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'takeScreenshot',
          workspaceId: currentSelectedWorkspace._id,
          storyId: story._id,
          authToken: authData.token,
        }, function (response) {

          window.close()
          console.log('capture message sent')
        })

        window.close()
      })

    } else if(captureType === CAPTURE_TYPE.video) {

      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {

        setIsRecording(true)


        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'takeVideo',
          workspaceId: currentSelectedWorkspace._id,
          storyId: story._id,
          authToken: authData.token,
        }, function (response) {

          window.close()
          console.log('capture message sent')
        })

        window.close()
      })
    }
  }

  return (
    <C.NewDemo>
      <C.Wrapper>
        <Header/>
        <C.MainContainer>
          {(isStoryLoading || !story || isSaving) ? <Spinner/> : (
            <C.StoryContainer>
              <C.TopSection>
                <C.OpenButton
                  onClick={() => {

                    window.open(`${ENV.SERVER_URL}/workspace/${story.workspaceId}/storydemo/${story._id}`, '_blank')
                  }}
                  className={'OpenButton'}>
                  <C.OpenButton__Text>{story.name}</C.OpenButton__Text>
                  <C.OpenButton__Icon type={'select'} rotate={90}/>
                </C.OpenButton>
                {/* <C.GetStartedButton__Wrapper>
                  <C.GetStartedButton__CaptureList>
                    {Object.keys(CAPTURE_TYPE).map((captureType) => {
                      let isSelected = false
                      if(captureType === selectedCaptureType) {
                          isSelected = true
                      }

                      return (
                        <C.GetStartedButton__CaptureListItem
                          key={captureType}
                          isSelected={isSelected}
                          onClick={() => {

                            setSelectedCaptureType(captureType)
                          }}
                        >
                          {getCaptureImage(captureType)}
                        </C.GetStartedButton__CaptureListItem>
                      )
                    })}
                  </C.GetStartedButton__CaptureList>
                  <C.GetStartedButton
                    onClick={() => {
                      getCaptureOnClick(selectedCaptureType, story, authData)
                    }}>
                    Capture {selectedCaptureType}
                  </C.GetStartedButton>
                </C.GetStartedButton__Wrapper> */}


              </C.TopSection>
              <ScreensList screens={story.screens}/>
            </C.StoryContainer>
          )}

        </C.MainContainer>
        <C.FooterContainer>
          <C.FooterWrapper>
            <IconTextButton
              onClick={() => {
                navigate('/dashboard')
              }}
              img={<C.DashboardIcon/>}
              text={'Dashboard'}
              buttonStyles={{
                boxShadow: 'none',
                border: 'none',
                '&:hover': {
                  border: 'none',
                  color: Colors.primaryColor,
                  cursor: 'pointer'
                },
                width: '140px;', fontSize: '0.9em'
              }}
            />
            <IconTextButton
              onClick={() => {
                navigate(backLocation)
              }}
              img={<C.BackIcon/>}
              text={'Back'}
              buttonStyles={{
                boxShadow: 'none',
                border: 'none',
                '&:hover': {
                  border: 'none',
                  color: Colors.primaryColor,
                  cursor: 'pointer'
                },
                width: '100px;',
                fontSize: '0.9em'
              }}
            />
          </C.FooterWrapper>
        </C.FooterContainer>
      </C.Wrapper>

    </C.NewDemo>
  )
}

const C = {
  GetStartedButton__Wrapper: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    
    width: 160px;
    height: 50px;
  `,
  GetStartedButton__CaptureList: styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-evenly;
    align-items: center;
    
    width: 100%;
    height: 20px;
  `,

  GetStartedButton__CaptureListItem: styled.span`
    width: 28px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    
    border: 1px solid transparent; 
    border-radius: 6px;
    cursor: pointer;
     
    && svg {
      width: 18px;
      height: 18px;
      fill: ${Colors.primaryColor};
    }
    
    ${({isSelected}) => {
      if(isSelected) {
        
        return `
          border: 1.5px solid ${Colors.primaryColor};
          && svg {
     
          }
        `
      } else {
        
        return ''
      }
  }}
  `,
  GetStartedButton: styled.button`
    border: none;
    // background: ${Colors.primaryColor};
    background: white;
    color: ${Colors.primaryColor};
    
    text-transform: capitalize;
    
    width: 100%;
    height: 25px;
    font-size: 0.9em;
    border-radius: 6px;
    
    transition: 0.2s ease-in-out;
    
    &&:hover {
      background: rgb(4,142,255);
      color: #F9F9F9;
      cursor: pointer;
    }
  `,
  StoryContainer: styled.div`
    height: 200px;
    width: 100%;
  `,
  StoryName: styled.h2`
    color: ${Colors.primaryColor};
    font-size: 1.2em;
    margin: 0px;
    text-transform: capitalize;
  `,
  TopSection: styled.section`
     display: flex;
     justify-content: space-between;
     align-items: center;
     padding: 5px 0px;
     border-bottom: 1px solid rgba(0,0,0,.06);
    
  `,
  OpenButton: styled.span`
    color: ${Colors.primaryText};
    font-size: 1.3em;
    text-transform: capitalize;
    transition: all 0.5s;
    display: flex;
    justify-content: start;
    align-items: center;
    gap: 15px;
    width: fit-content;
    
    height: 50px;
    box-sizing: border-box;
    border-bottom: 1px solid white;
    border-top: 1px solid white;
    border-left: 1px solid white;
    border-right: 1px solid white;
    
    border-radius: 4px;
    padding: 10px;
    

    
    &&:hover {
     cursor: pointer;
     border: 1px solid ${Colors.primaryColor};
    }
    
  `,
  OpenButton__Text: styled.p`
    margin: 0px;
    
    max-width: 235px;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow-x: clip;
  `,
  OpenButton__Icon: styled(Icon)`

  `,
  NewDemo: styled.div`
    background: white;
    width: 100%;
    height: 100%;

  `,
  Wrapper: styled.div`
    width: 100%;
    height: 100%;
    
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  `,
  MainContainer: styled.div`
    display: flex;
    flex-direction: column;
    justify-content: start;
    align-items: center;
    flex-grow: 1;
    width: 294px;

  `,
  FooterContainer: styled.div`
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    width: 100%;
    border-top: 1px solid rgba(0,0,0,.06);
    padding-bottom: 6px;
    padding-top: 4px;
     
  `,
  FooterWrapper: styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: 294px;
    padding-bottom: 6px;
    padding-top: 4px;
     
  `,
  LogoContainer: styled.div`
    display: flex;
    flex-direction: row;
    -webkit-align-items: center;
    -webkit-box-align: center;
    -ms-flex-align: center;
    align-items: center;
    height: 60px;
    width: 294px;
    border-bottom: 1px solid rgba(0,0,0,.06);
    /* padding: 20px 20px 20px 20px; */
    text-align: center;
    justify-content: flex-start;
    padding: 0 28px;

  `,
  Logo: styled.img`
      && {
        width: 24px;
        height: 24px;
        vertical-align: middle;
        padding: 8px 0px;      
      }
      
      && svg {
        fill: ${Colors.primaryColor};
        width: 100%;
        height: 100%;
      }
  `,
  LogoText: styled.p`
    margin: 3px 0 0 8px;
    padding: 0;
    font-size: 1.1em;
    font-weight: bold;
    width: 70px;
    height: 40px;
    display: block;
    line-height: 40px;
    vertical-align: middle;
    text-transform: uppercase;
    color: black;
    letter-spacing: 2.2px;
  `,
  TextSplitter: styled.p`
    color: #8d9599;
    font-size: 1.3em;
    text-align: center;
    margin: 20px auto;
  `,
  BackIcon: styled(LeftCircleOutlined)`
    line-height: 50px;
    justify-content: center;
    align-items: center;
    display: flex;
    
    &&.anticon {
      width: 30px;
      height: 30px;
    }
    
    &&.anticon svg {
      width: 100%;
      height: 100%;
    }
  `,
  NewDemoIcon: styled(PlayCircleOutlined)`
    line-height: 50px;
    justify-content: center;
    align-items: center;
    display: flex;
    
    &&.anticon {
      width: 30px;
      height: 30px;
    }
    
    &&.anticon svg {
      width: 100%;
      height: 100%;
    }
  `,
  StartRecordingIcon: styled(PlayCircleOutlined)`
    line-height: 50px;
    justify-content: center;
    align-items: center;
    display: flex;
    
    &&.anticon {
      width: 30px;
      height: 30px;
    }
    
    &&.anticon svg {
      width: 100%;
      height: 100%;
      
      fill: green;
    }
  `,
  StyledInput: styled(Input)`
    height: 50px;
    font-size: 1.15em;
    box-sizing: border-box;
    border-radius: 4px;
    padding: 14px 16px;
    width: 191px;
    margin: 60px 0px 30px 0px;

    border: 1px solid #8d9599;
    
    &&:hover {
      border: 1px solid ${Colors.primaryColor};
    }
    
    &&:focus-visible {
      outline: none;
      border: 2px solid ${Colors.primaryColor};
    }

  `,
  DashboardIcon: styled(BarsOutlined)`
    line-height: 50px;
    justify-content: center;
    align-items: center;
    display: flex;

    &&.anticon {
      width: 30px;
      height: 30px;
    }

    &&.anticon svg {
      width: 100%;
      height: 100%;
    }
  `,
  StopRecordingIcon: styled(PauseCircleOutlined)`
    line-height: 50px;
    justify-content: center;
    align-items: center;
    display: flex;

    &&.anticon {
      width: 30px;
      height: 30px;
    }

    &&.anticon svg {
      width: 100%;
      height: 100%;
      
      fill: #FF0000;
    }
  `
}


export default StoryPage
