import React, {useState, useEffect, Suspense} from 'react'
import "./Login.css"

import styled from 'styled-components'
import {useRecoilState, useRecoilValue} from 'recoil'
import * as state from '../../state'
import IconTextButton from '../../components/IconTextButton/IconTextButton'
import Logo from '../../../../../src/assets/img/logo-round.svg'
import Colors from '../../../../constants/mainColors'
import ENV from '../../../../config.json'

function getChromeVersion(){
  let version = 0
  try {
    version = parseInt(/Chrome\/([0-9.]+)/.exec(navigator.userAgent)[1].split('.')[0])
  } catch(err) {
    console.log(err)
    console.log('Couldn\'t getChromeVersion')
  }

  return version
}

const SUPPORTED_BROWSER_VERSION = 100

const Login = function (props) {
  let currentBrowserVersion = getChromeVersion()

  let [authDataState, setAuthData] = useRecoilState(state.authDataState)
  let [text, setText] = useState('')
  console.log(authDataState)

  useEffect(() => {
        if(authDataState && authDataState.authData && authDataState.authData.name) {
      setText('authenticated')
    } else {
      setText('unauthenticated')
    }
  }, [])

  // function onTextChange(e) {
  //
  //   setText(e.target.value)
  //   setAuthData({text: e.target.value})
  // }

  function onLogin(e) {
    window.open(`${ENV.SERVER_URL}/login`, '_blank')
  }

  function onSignup(e) {
    window.open(`${ENV.SERVER_URL}/register`, '_blank')
  }

  return (
    <L.Login className="Login">
      <L.Wrapper>
        <L.LogoContainer>
          <L.Logo src={Logo}/>
          <L.LogoText>LiveDemo</L.LogoText>
        </L.LogoContainer>
        {currentBrowserVersion < SUPPORTED_BROWSER_VERSION ? (
            <L.MainContainer>
            <L.MessageText>Please update Chrome to a later version</L.MessageText>
            </L.MainContainer>
        ) : (<L.MainContainer>
          <IconTextButton
              onClick={(e) => {
                onLogin(e)
              }}
              text={'Login'}
              buttonStyles={{ width: '100%' }}
          />
          <L.TextSplitter>or
          </L.TextSplitter>

          <IconTextButton
              onClick={(e) => {
                onSignup(e)
              }}
              text={'Sign Up'}
              buttonStyles={{ width: '100%' }}
          />
        </L.MainContainer>)}

      </L.Wrapper>


    </L.Login>
  )
}

const L = {
  Login: styled.div`
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
  LogoContainer: styled.div`
    display: flex;
    flex-direction: row;
    -webkit-align-items: center;
    -webkit-box-align: center;
    -ms-flex-align: center;
    align-items: center;
    height: 80px;
    width: 294px;
    border-bottom: 1px solid rgba(0,0,0,.06);
    /* padding: 20px 20px 20px 20px; */
    text-align: center;
    justify-content: flex-start;
    padding: 0 28px;

  `,
  Logo: styled.img`
      && {
        width: 37px;
        height: 37px;
        vertical-align: middle;
      
      }
      
      && svg {
        fill: ${Colors.primaryColor};
        width: 100%;
        height: 100%;
      }
  `,
  LogoText: styled.p`
    margin: 0 0 0 8px;
    padding: 0;
    font-size: 2em;
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
  MessageText: styled.p`
    margin: 0 0 0 8px;
    padding: 0;
    font-size: 1.2em;
    font-family: ${Colors.fontFamily};
    font-weight: bold;
    //width: 70px;
    //height: 40px;
    display: block;
    line-height: 40px;
    vertical-align: middle;
    color: black;
    letter-spacing: 2.2px;
  `,
  TextSplitter: styled.p`
    color: #8d9599;
    font-size: 1.3em;
    text-align: center;
    margin: 20px auto;
  `,
}

export default Login
