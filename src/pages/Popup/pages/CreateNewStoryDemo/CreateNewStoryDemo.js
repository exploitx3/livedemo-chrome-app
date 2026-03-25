import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import Colors from '../../../../constants/mainColors'
import { BarsOutlined, LeftCircleOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
import IconTextButton from '../../components/IconTextButton/IconTextButton'
import Header from '../../components/Header/Header'
import Spinner from '../../components/Spinner/Spinner'
import { useNavigate } from 'react-router-dom'
import { useRecoilState, useRecoilValue } from 'recoil'
import * as state from '../../state'
import { Input } from 'antd'
import axios from '../../../../helpers/axiosInstance'
import * as ENV from '../../../../config.json'

const CreateNewStoryDemo = function (props) {
  let navigate = useNavigate()
  const [previousLocation, setPreviousLocation] = useRecoilState(state.previousLocationState)
  const [backLocation, setBackLocation] = useRecoilState(state.backLocationState)

  const [authData, setAuthData] = useRecoilState(state.authDataState)
  const currentSelectedWorkspace = useRecoilValue(state.currentSelectedWorkspace)
  const [sessionRecordingId, setSessionRecordingId] = useRecoilState(state.sessionRecordingIdState)

  const [isLoading, setIsLoading] = useState(false)

  const [isNameChosen, setIsNameChosen] = useState(false)
  const [newDemoName, setNewDemoName] = useState('')

  const [isSaving, setIsSaving] = useState(false)



  function createStoryDemo(workspaceId, authToken) {
    setIsLoading(true)

    return axios.post(`${ENV.STORIES_API}/stories`, {
        name: newDemoName,
        workspaceId: currentSelectedWorkspace._id
      }, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        }
      })
      .then((res) => {

        setIsLoading(false)
        navigate(`/story/${res.data._id}`)

        return res.data
      })
  }

  function getImage() {


    return new Promise((resolve, reject) => {

      chrome.tabs.captureVisibleTab(
        null, { format: 'png', quality: 50 }, function (data) {

          // let canvas = document.createElement('canvas')
          // var image = new Image()
          // image.onload = function () {
          //
          //
          //   canvas.width = 768
          //   canvas.height = 1024
          //
          //   var context = canvas.getContext('2d')
          // context.drawImage(image, x * zoomX, y * zoomY, width * zoomX,
          //   height * zoomY, 0, 0, width * zoomX, height * zoomY)

          // }
          // image.src = data

          resolve(data)
        })
    })

  }

  useEffect(() => {


    // checkRecording()
    //   .then((isRecording) => {
    //     setIsRecording(isRecording)
    //
    //     if (!isRecording) {
    //       setIsNameChosen(false)
    //       setNewDemoName('')
    //     }
    //   })
    //
    // return () => {
    //   setIsNameChosen(false)
    //   setNewDemoName('')
    //
    // }

  }, [])

  function checkRecording() {

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'checkRecording',
      }, function (response) {

        console.log('checkRecording ' + response)
        resolve(response)
      })
    })

  }

  async function capture() {
    setIsNameChosen(true)


    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {

      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'getStarted',
        workspaceId: '62255d3d3304f17b8f5e2d03',
        storyId: '62afb9aecd65cd7f6096bb43',
        authToken: authData.token,
      }, function (response) {

        console.log('capture message sent')
      })


    })


  }

  function stopRecording() {


  }

  function onLogout() {
    chrome.runtime.sendMessage({ type: 'unauthenticate' })
    setAuthData({})
    navigate('/login')
  }

  return (
    <C.NewDemo>
      <C.Wrapper>
        <Header/>
        <C.MainContainer>
          <C.StyledInput
            name={'name-input'}
            size="large"
            autoFocus
            placeholder="Untitled"
            value={newDemoName}
            onChange={(event) => {

              setNewDemoName(event.target.value)
            }}
            onPressEnter={(e) => {
              return createStoryDemo(currentSelectedWorkspace._id, authData.token)
            }}
          />
          {isLoading ? (
            <Spinner/>
          ) : (
            <React.Fragment>

              {!isLoading ? (<IconTextButton
                onClick={() => {
                  return createStoryDemo(currentSelectedWorkspace._id, authData.token)
                }}
                img={<C.StartRecordingIcon/>}
                text={'Create a Story Demo'}
                buttonStyles={{
                  boxShadow: 'none',
                  border: 'none',
                  '&:hover': {
                    border: 'none',
                    color: 'green',
                    cursor: 'pointer'
                  },
                  width: '240px;', fontSize: '1.2em'
                }}
              />) : ''}


              {isLoading ? (<IconTextButton
                onClick={() => {

                  return stopRecording()
                }}
                img={<C.StopRecordingIcon/>}
                text={'Stop Recording'}
                buttonStyles={{
                  boxShadow: 'none',
                  border: 'none',
                  '&:hover': {
                    border: 'none',
                    color: '#FF0000',
                    cursor: 'pointer'
                  },
                  width: '240px;', fontSize: '1.2em'
                }}
              />) : ''

              }

            </React.Fragment>
          )
          }

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


export default CreateNewStoryDemo
