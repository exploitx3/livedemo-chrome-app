import React from 'react'
import styled from 'styled-components'
import Colors from '../../../../../../constants/mainColors'
import ScreenTypes from '../../../../../../constants/ScreenTypes'
import { Icon } from 'antd'
import { useNavigate } from 'react-router-dom'

const ScreensList = (props) => {
  let navigate = useNavigate()

  let {
    screens
  } = props

  if (screens && screens.length === 0) {
    return (
      <S.Wrapper>
        <S.List>
          <S.NoDemosText>
            There are no screens yet
          </S.NoDemosText>
        </S.List>
      </S.Wrapper>
    )
  }

  function getCleanUrl(url) {
    return url.replace(/http(s)*\:\/\//g, '')
  }

  function getScreenName(screen) {


    if (screen.type === ScreenTypes.SCREEN_VIDEO) {
      return screen.name ? getCleanUrl(screen.name) : 'Video'
    }

    if (screen.type === ScreenTypes.SCREEN_PAGE) {
      return screen.name ? getCleanUrl(screen.name) : 'Page'
    }

    if (screen.type === ScreenTypes.SCREEN_SCREENSHOT) {
      return screen.name ? getCleanUrl(screen.name) : 'Screenshot'
    }

    return ''
  }

  function getScreenImage(screen) {
    
    if (screen.type === ScreenTypes.SCREEN_VIDEO) {
      return `https://image.mux.com/${screen.asset.playback_ids[0].id}/thumbnail.png`
    } else {

      return screen.imageUrl
    }
  }


  function getScreenIcon(screen) {
    if (screen.type === 'Screen_Page') {

      return <S.LiveDemoTypeImage>
        <svg className="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium MuiBox-root css-1om0hkc" focusable="false"
             aria-hidden="true" viewBox="0 0 24 24" data-testid="WebIcon">
          <path
            d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z"></path>
        </svg>
      </S.LiveDemoTypeImage>
    } else if (screen.type === 'Screen_Screenshot') {

      return <S.LiveDemoTypeImage>
        <Icon type={'picture'}/>
      </S.LiveDemoTypeImage>
    } else if (screen.type === 'Screen_Video') {

      return <S.LiveDemoTypeImage>
        <Icon type={'video-camera'}/>
      </S.LiveDemoTypeImage>
    }
  }

  return (
    <S.Wrapper>
      <S.List>
        {screens.map((screen) => {
          return (
            <S.ListItem key={screen._id} onClick={() => {

              navigate(`/story/${screen._id}`)
            }}>
              <S.LiveDemoImageWrapper>
                <S.LiveDemoImage src={getScreenImage(screen)}/>
                {getScreenIcon(screen)}
              </S.LiveDemoImageWrapper>
              <S.DemoName>{getScreenName(screen)}</S.DemoName>

            </S.ListItem>
          )
        })}
      </S.List>
    </S.Wrapper>
  )
}

const S = {
  Wrapper: styled.div`
    width: 100%;
    height: 100%
  `,
  List: styled.ul`
    width: 100%;
    height: 200px;
    overflow-y: scroll;
    margin: 20px 0px 0px 0px;
    padding: 0px 15px 0px 0px;
    
    &&::-webkit-scrollbar-track {
      -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.3);
      border-radius: 10px;
      background-color: #fff;
    }
    
    &&::-webkit-scrollbar {
      width: 2px;
      background-color: #fff;
    }
    
    &&::-webkit-scrollbar-thumb {
      border-radius: 10px;
      //-webkit-box-shadow: inset 0 0 6px rgba(0,0,0,.3);
      background-color: ${Colors.primaryColor};
    }
    
  `,
  NoDemosText: styled.p`
    
  `,
  ListItem: styled.li`
    width: 100%;
    height: 50px;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    
    &&:hover {
      color: ${Colors.primaryColor};
      cursor: pointer;
    }
    
    &&:hover .OpenButton {
      border: 1px solid ${Colors.primaryColor};
    }
  `,
  LiveDemoImageWrapper: styled.span`
    width: 60px;
    min-width: 60px;
    height: 35px;
    border-radius: 6px;
    border: 1px solid ${Colors.primaryColor};
    position: relative;
  `,
  LiveDemoImage: styled.img`
    width: 100%;
    height: 100%;
  `,
  LiveDemoTypeImage: styled.span`
    position: absolute;
    width: 100%;
    height: 100%;
    opacity: 0.8;
    line-height: 55px;
    display: flex;
    top: 0;
    justify-content: center;
    align-items: center;
    
    
    && svg {
      width: 100%;
      height: 100%;
      fill: ${Colors.primaryColor};
    }
    
    && i {
      width: 25px;
      height: 25px;
    }
  `,
  EmptyImage: styled.span`
    //&& svg {
    //  width: 25px;
    //  height: 35px;
    //  line-height: 35px;
    //  fill: #1070ff;
    //}

    width: 60px;
    min-width: 60px;
    height: 35px;
    border-radius: 6px;
    border: 1px solid ${Colors.primaryColor};
  `,
  DemoName: styled.p`
    flex-grow: 1;
    text-align: left;
    margin: 0px 0px 0px 20px;
    text-overflow: ellipsis;
    white-space: nowrap;
    justify-self: flex-start;
    overflow: hidden;
  `,
  OpenButton: styled.span`
    transition: all 0.3s;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 40px;
    width: 80px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    padding: 10px;
    
    
  `,
  OpenButton__Text: styled.p`
    margin: 0px;
  `,
  OpenButton__Icon: styled(Icon)`

  `,


}

export default ScreensList
