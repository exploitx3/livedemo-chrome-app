/* eslint-disable import/default */

import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import 'react-circular-progressbar/dist/styles.css'
// import 'antd/dist/antd.css'


const CountdownComponent = function ({onFinish = () => {return Promise.resolve()}}) {

  let [count, setCount] = useState(3)

  useEffect(() => {
    let innerCount = 3
    let timer = setInterval(() => {

      innerCount -= 1
      setCount(innerCount)

      if (innerCount <= 0) {
        clearInterval(timer)

        onFinish()


      }

    }, 1000)
  }, [])


  function removeCountdownComponent() {

    let element = document.getElementById('countdown-storydemo-wrapper')
    element.remove()
  }

  return (<CD.Wrapper id={"countdown-storydemo-wrapper"}>
      <CD.Countdown__Content>
        <CD.Countdown__Text>
          {count}
        </CD.Countdown__Text>
      </CD.Countdown__Content>

    </CD.Wrapper>
  )
}

const CD = {
  Wrapper: styled.div`
    z-index: 999999999999;
    position: fixed;
    height: 100vh;
    width: 100vw;
    background: rgba(17,17,17,0.9);
    
    display: flex;
    justify-content: center;
    align-items: center;
  `,
  Countdown__Content: styled.div`
    
  `,
  Countdown__Text: styled.span`
    font-size: 12rem;
    color: #f9f9f9;
    font-family: Arial, Helvetica, sans-serif !important;
  `
}

export default CountdownComponent
