import React, { useEffect, useState } from 'react'
import './Dashboard.css'

import { LogoutOutlined, PictureOutlined, PlayCircleOutlined, VideoCameraOutlined } from '@ant-design/icons'
import { useRecoilState } from 'recoil'
import * as state from '../../state'
import { useNavigate } from 'react-router-dom'
import IconTextButton from '../../components/IconTextButton/IconTextButton'
import Header from '../../components/Header/Header'
import Spinner from '../../components/Spinner/Spinner'
import StoryDemosList from '../../components/StoryDemosList/StoryDemosList'
import ImagesList from '../../components/ImagesList/ImagesList'
import VideosList from '../../components/VideosList/VideosList'
import styled from 'styled-components'
import Colors from '../../../../constants/mainColors'
import axios from '../../../../helpers/axiosInstance'
import * as ENV from '../../../../config.json'
import { Tabs } from 'antd'

const { TabPane } = Tabs
const TAB_KEYS = {
  livedemos: 'livedemos',
  // videos: 'videos',
  // images: 'images',
  // storydemos: 'storydemos',
}


const Dashboard = function ({view}) {

  let [activeTab, setActiveTab] = useState(view ? view : TAB_KEYS.livedemos)

  let [authDataState, setAuthData] = useRecoilState(state.authDataState)
  let [previousLocation, setPreviousLocation] = useRecoilState(state.previousLocationState)
  let [currentSelectedWorkspace, setCurrentSelectedWorkspace] = useRecoilState(state.currentSelectedWorkspace)
  let [liveDemos, setLiveDemos] = useState([])
  let [storyDemos, setStoryDemos] = useState([])
  let [libraryObj, setLibraryObj] = useState({})

  let [areResourcesLoading, setAreResourcesLoading] = useState(false)
  let [userWorkspaces, setUserWorkspaces] = useRecoilState(state.userWorkspaces)

  const [isSaving, setIsSaving] = useState(false)
  const [isRecording, setIsRecording] = useRecoilState(state.isRecordingState)

  // let resetAuthData = useResetRecoilState(state.authDataState)
  let navigate = useNavigate()


  function getStoryDemos(workspaceId, authToken) {

    return axios.get(`${ENV.STORIES_API}/workspaces/${workspaceId}/stories`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        }
      })
      .then((res) => {

        setStoryDemos(res.data)
        setAreResourcesLoading(false)

        return res.data
      })
  }

  function getLibrary(workspaceId, authToken) {

    return axios.get(`${ENV.STORIES_API}/workspaces/${workspaceId}/library`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        }
      })
      .then((res) => {

        setLibraryObj(res.data)

        return res.data
      })
  }

  function updateResources(currentSelectedWorkspace, authDataState) {

    if(currentSelectedWorkspace && currentSelectedWorkspace._id) {
      setAreResourcesLoading(true)

      return Promise.all([
          getStoryDemos(currentSelectedWorkspace._id, authDataState.token),
          getLibrary(currentSelectedWorkspace._id, authDataState.token)
        ])
        .then(() => {
          setAreResourcesLoading(false)
        })
        .catch(e => {
          console.log(e)
          setAreResourcesLoading(false)
          if (e.response?.status === 401) {
            onLogout()
          }
        })
    }
  }

  useEffect(() => {

    updateResources(currentSelectedWorkspace, authDataState)
  }, [])

  useEffect(() => {

    chrome.runtime.onMessage.addListener(
      function (request, sender, sendResponse) {

        if (request.name === 'popup_video_recordingCompleted') {

          console.log('popup_video_recordingCompleted:')
          console.log(request)

          updateResources(currentSelectedWorkspace, authDataState)
            .then(() => {

              setIsSaving(false)
            })

        }

        sendResponse({})
      }
    )

  })

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

  }, [])


  function untillNotNull(funcPromise, times) {
    let finalPromise = new Promise((resolve, reject) => {
      let result = null

      let promiseChain = Promise.resolve()

      for (let i = 0; i < times; i++) {
        promiseChain = promiseChain.then(() => {
            return funcPromise()
              .then((res) => {

                if (res !== null) {
                  result = res
                  throw new Error('successful')
                }
              })
          })
          .then(() => {

            return new Promise((resolveInternal, rejectInternal) => {
              setTimeout(() => {
                resolveInternal()
              }, 2000)

            })
          })

      }

      return promiseChain
        .catch(err => {

          resolve(result)
        })
    })


    return finalPromise
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
        setTimeout(() => {


          setIsSaving(false)

          resolve(res)

        }, 15000)

      })

    })


  }


  useEffect(() => {

    updateResources(currentSelectedWorkspace, authDataState)
  }, [currentSelectedWorkspace])

  function onLogout() {



    chrome.runtime.sendMessage({ type: 'unauthenticate' }, function(res) {
      console.log('unauthenticate response from background - ' + res)

      setAuthData({})
      setUserWorkspaces('')
      setCurrentSelectedWorkspace('')
      navigate('/login')
    })

  }


  function getLeftButtonBasedOnTab(tabOpen) {
    if (tabOpen === TAB_KEYS.livedemos) {

      return <IconTextButton
        onClick={() => {
          navigate('/new-demo')
        }}
        img={<D.NewDemoIcon/>}
        text={'New Demo'}
        buttonStyles={{
          border: 'none',
          '&:hover': {
            border: 'none',
            color: Colors.primaryColor,
            cursor: 'pointer'
          },
          boxShadow: 'none',
          width: '190px;', fontSize: '0.9em',
          justifyContent: 'start'
        }}
      />
    }

    if (tabOpen === TAB_KEYS.images) {

      return <IconTextButton
        onClick={() => {
          // Capture Screenshot

          chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {


            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'takeScreenshot',
              workspaceId: currentSelectedWorkspace._id,
              authToken: authDataState.token,
            }, function (response) {

              window.close()
              console.log('capture message sent')
            })

            window.close()


          })
        }}
        img={
          <PictureOutlined/>
        }
        text={'Take Screenshot'}
        buttonStyles={{
          border: 'none',
          '&:hover': {
            border: 'none',
            color: Colors.primaryColor,
            cursor: 'pointer',
          },
          justifyContent: 'start',
          boxShadow: 'none',
          width: '190px;', fontSize: '0.9em'
        }}
      />
    }

    if (tabOpen === TAB_KEYS.videos) {

      return <IconTextButton
        onClick={() => {



          chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {

            setIsRecording(true)


            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'takeVideo',
              workspaceId: currentSelectedWorkspace._id,
              authToken: authDataState.token,
            }, function (response) {

              window.close()
              console.log('capture message sent')
            })

            window.close()
          })
        }}
        img={
          <VideoCameraOutlined/>
        }
        text={'Take Video'}
        buttonStyles={{
          border: 'none',
          '&:hover': {
            border: 'none',
            color: Colors.primaryColor,
            cursor: 'pointer',
          },
          justifyContent: 'start',
          boxShadow: 'none',
          width: '190px;', fontSize: '0.9em'
        }}
      />
    }

    return <IconTextButton
      onClick={() => {
        navigate('/new-demo')
      }}
      img={<D.NewDemoIcon/>}
      text={'New Demo'}
      buttonStyles={{
        border: 'none',
        '&:hover': {
          border: 'none',
          color: Colors.primaryColor,
          cursor: 'pointer',
        },
        justifyContent: 'start',
        boxShadow: 'none',
        width: '190px;', fontSize: '0.9em'
      }}
    />
  }

  return (
    <D.Dashboard>
      <D.Wrapper>
        <Header/>
        <D.MainContainer>
          {isSaving ? <Spinner/> : (

            <Tabs
              defaultActiveKey={activeTab}
              activeKey={activeTab}
              onChange={(newActiveTab) => {
                setPreviousLocation(`/dashboard/${newActiveTab}`)
                setActiveTab(newActiveTab)
              }}
              animated={false}
              tabPosition={'top'}
            >


              <TabPane tab={'Live Demos'} key={TAB_KEYS.livedemos}>
                <D.TabWrapper>
                  {areResourcesLoading ? <Spinner/> : (
                    <StoryDemosList storyDemos={storyDemos}/>
                  )}
                </D.TabWrapper>
              </TabPane>
              {/*<TabPane tab={'Images'} key={TAB_KEYS.images}>*/}
              {/*  <D.TabWrapper>*/}
              {/*    {areResourcesLoading ? <Spinner/> : (*/}
              {/*      <ImagesList images={libraryObj.screenshots ? libraryObj.screenshots : []}/>*/}
              {/*    )}*/}
              {/*  </D.TabWrapper>*/}
              {/*</TabPane>*/}

              {/*<TabPane tab={'Videos'} key={TAB_KEYS.videos}>*/}
              {/*  <D.TabWrapper>*/}
              {/*    {areResourcesLoading ? <Spinner/> : (*/}
              {/*      <VideosList videos={libraryObj.videos ? libraryObj.videos : []}/>*/}
              {/*    )}*/}
              {/*  </D.TabWrapper>*/}
              {/*</TabPane>*/}
              {/*<TabPane tab={'Live Demos'} disabled={true} key={TAB_KEYS.livedemos}>*/}
              {/*  <D.TabWrapper>*/}
              {/*    {areLiveDemosLoading ? <Spinner/> : (*/}
              {/*      <LiveDemosList liveDemos={liveDemos}/>*/}
              {/*    )}*/}
              {/*  </D.TabWrapper>*/}
              {/*</TabPane>*/}

            </Tabs>
          )}



        </D.MainContainer>
        <D.FooterContainer>
          <D.FooterWrapper>
            {getLeftButtonBasedOnTab(activeTab)}
            <IconTextButton
              onClick={onLogout}
              img={<D.LogoutIcon/>}
              text={'Logout'}
              buttonStyles={{
                border: 'none',
                '&:hover': {
                  border: 'none',
                  color: Colors.primaryColor,
                  cursor: 'pointer'
                },
                boxShadow: 'none',
                width: '100px;', fontSize: '0.9em'
              }}
            />
          </D.FooterWrapper>
        </D.FooterContainer>
      </D.Wrapper>

    </D.Dashboard>
  )
}

const D = {
  TabWrapper: styled.div`
    width: 100%;
    height: 200px;
  `,
  Dashboard: styled.div`
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
    justify-content: center;
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
  LogoutIcon: styled(LogoutOutlined)`
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
  `
}

export default Dashboard
