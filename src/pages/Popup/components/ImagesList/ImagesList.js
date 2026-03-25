

import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import Colors from '../../../../constants/mainColors'
import {Icon, Modal, Tabs} from 'antd'


const ImagesList = ({images}) => {

  return (

    <IT.Wrapper>
      <IT.Main>
        {images && [...images].reverse().map((image) => {

          return (
            <IT.ImageWrapper id={image._id} key={image._id}>
              <IT.Image src={image.imageUrl}/>
            </IT.ImageWrapper>
          )
        })}
      </IT.Main>
    </IT.Wrapper>
  )
}

const IT = {
  Wrapper: styled.div`
    width: 100%;
    height: 100%;
    overflow-y: scroll;

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
  Main: styled.main`
    display: grid;
    
    grid-gap: 0.5rem;
    grid-template-columns: repeat(3,0.5fr);
    grid-template-rows: 90px;
  `,
  ImageWrapper: styled.figure`
    border: 7px solid #fff;
    border-radius: 16px;
    box-sizing: border-box;
    width: 100%;
    height: 90px;
    margin: 0;
    
    &&:hover {
        border-color: #e5e7eb;
        cursor: pointer;
    }
  `,
  Image: styled.img`
    width: 100%;
    height: 100%;
    border-radius: 8px;

  `
}

export default ImagesList
