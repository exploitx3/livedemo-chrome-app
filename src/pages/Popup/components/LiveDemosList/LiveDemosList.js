import React from 'react'
import styled from 'styled-components'
import Colors from '../../../../constants/mainColors'
import Triangle from '../../../../assets/img/rounded-triangle.svg'
import {Icon} from 'antd'
import ENV from '../../../../config.json'

const LiveDemosList = (props) => {
  let {
    liveDemos
  } = props

  if(liveDemos && liveDemos.length === 0) {
    return (
      <S.Wrapper>
        <S.List>
          <S.NoDemosText>
            There are no live demos yet
          </S.NoDemosText>
        </S.List>
      </S.Wrapper>
    )
  }

  return (
    <S.Wrapper>
      <S.List>
      {liveDemos.map((liveDemo) => {
        return (
          <S.ListItem key={liveDemo._id} onClick={() => {

            window.open(`${ENV.SERVER_URL}/workspace/${liveDemo.workspaceId}/livedemo/${liveDemo._id}`, '_blank')

          }}>
            <S.LiveDemoImage src={Triangle} alt="rounded-triangle"/>
            <S.DemoName>{liveDemo.name}</S.DemoName>
            <S.OpenButton className={'OpenButton'}>
              <S.OpenButton__Text>Open</S.OpenButton__Text>
              <S.OpenButton__Icon type={'select'} rotate={90}/>
            </S.OpenButton>
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
  LiveDemoImage: styled.img`

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

export default LiveDemosList
