import React from 'react'
import styled from 'styled-components'
import Colors from '../../../../constants/mainColors'
import Triangle from '../../../../assets/img/rounded-triangle.svg'
import {Icon} from 'antd'
import ENV from '../../../../config.json'
import {useNavigate} from 'react-router-dom'

const StoryDemosList = (props) => {
  let navigate = useNavigate()

  let {
    storyDemos
  } = props

  if(storyDemos && storyDemos.length === 0) {
    return (
      <S.Wrapper>
        <S.List>
          <S.NoDemosText>
            There are no story demos yet
          </S.NoDemosText>
        </S.List>
      </S.Wrapper>
    )
  }

  return (
    <S.Wrapper>
      <S.List>
      {storyDemos.map((storyDemo) => {
        return (
          <S.ListItem key={storyDemo._id} onClick={() => {

            navigate(`/story/${storyDemo._id}`)
          }}>
            <S.LiveDemoImage src={Triangle} alt="rounded-triangle"/>
            <S.DemoName>{storyDemo.name}</S.DemoName>
            <S.RightArrow className={'StoryItem__Arrow'} type={'right'}/>
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
    width: 350px;
    height: 200px;
    overflow-y: scroll;
    padding: 0px 25px;
    
    &&::-webkit-scrollbar-track {
      -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.3);
      border-radius: 10px;
      background-color: #fff;
    }
    
    &&::-webkit-scrollbar {
      width: 4px;
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
    border-bottom: 1px solid #dddddd;
    
    width: 100%;
    height: 70px;
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    
    &&:hover {
      color: ${Colors.primaryColor};
      cursor: pointer;
    }
    
    &&:hover .OpenButton {
      border: 1px solid ${Colors.primaryColor};
    }
    
    
    &&:hover .StoryItem__Arrow svg {
      fill: ${Colors.primaryColor};
    }
  `,
  LiveDemoImage: styled.img`
    width: 40px;
    height: 40px;
    
  `,
  DemoName: styled.p`
    text-align: left;
    margin: 0px 0px 0px 20px;
    justify-self: flex-start;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    flex-grow: 1;
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
  RightArrow: styled(Icon)`
    text-align: right;
    
    && svg {
      width: 14px;
      height: 14px;
      fill: #aaa;
    }
  `


}

export default StoryDemosList
