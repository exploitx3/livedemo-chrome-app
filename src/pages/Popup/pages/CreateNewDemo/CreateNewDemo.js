import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import Colors from '../../../../constants/mainColors'
import {
  BarsOutlined,
  LeftCircleOutlined,
  LogoutOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons'
import IconTextButton from '../../components/IconTextButton/IconTextButton'
import Header from '../../components/Header/Header'
import Spinner from '../../components/Spinner/Spinner'
import { useNavigate } from 'react-router-dom'
import { useRecoilState, useRecoilValue } from 'recoil'
import * as state from '../../state'
import { Input } from 'antd'

const CreateNewDemo = function (props) {
  let navigate = useNavigate()
  const [backLocation, setBackLocation] = useRecoilState(state.backLocationState)

  const [authData, setAuthData] = useRecoilState(state.authDataState)
  const currentSelectedWorkspace = useRecoilValue(state.currentSelectedWorkspace)




  useEffect(() => {


  }, [])


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

            <C.ButtonsWrapper>

              <C.TextButton onClick={() => {
                navigate('/new-flix-demo')
              }}>
                Flix Demo
              </C.TextButton>
              <C.TextSeperator>
                or
              </C.TextSeperator>
              <C.TextButton onClick={() => {
                navigate('/new-story-demo')
              }}>
                Story Demo
              </C.TextButton>
              <C.TextSeperator>
                or
              </C.TextSeperator>
              <C.TextButton disabled={true} className={'disabled'} onClick={() => {
                navigate('/new-live-demo')
              }}>
                Live Demo
              </C.TextButton>


            </C.ButtonsWrapper>

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
              onClick={()=> {
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
  ButtonsWrapper: styled.div`
     width: 100%;
  `,
  TextButton: styled.button`
    border: 1px solid ${Colors.primaryColor};
    color: ${Colors.primaryText};
    
    width: 100%;
    height: 50px;
    font-size: 1.2em;
    border-radius: 6px;
    background: white;
    
    transition: 0.2s ease-in-out;
    
    &&.disabled {
      background: #C5C5C5;
      color: #F9F9F9;
      border: none;
    }
     
    &&.disabled:hover {
      background: #C5C5C5;
      color: #F9F9F9;

    }
     
    &&:hover {
      background: ${Colors.primaryColor};
      color: #F9F9F9;
      cursor: pointer;
    }
  `,
  TextSeperator: styled.p`
    margin: 20px 0px;
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


export default CreateNewDemo
