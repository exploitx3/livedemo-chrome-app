import React from 'react'
import styled from 'styled-components'
import mainColors from '../../../../constants/mainColors'

const TextButton = ({ onClick, img, loading, text, buttonStyles }) => {


  return (
    <S.Button onClick={onClick} loading={loading} buttonStyles={buttonStyles}>
      {img ? img : ''}
      <S.Text>{text}</S.Text>
    </S.Button>
  )
}

const S = {
  Button: styled.button(props => ({
    transition: 'all 0.3s',
    background: '#FFF',
    color: '#8d9599',
    textAlign: 'center',
    display: 'flex',
    border: 'solid 1px #dae3f2',
    height: '50px',
    width: '300px',
    borderRadius: '5px',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 2px 5px rgb(0 0 0 / 5%)',
    '&:hover': {
      cursor: 'pointer',
      border: `solid 1px ${mainColors.primaryColor}`,
    },

    '&& .anticon > svg': {
      width: '1.5em',
      height: '1.5em'
    },

    ...props.buttonStyles,
  })),
  Text: styled.p`
    height: 50px;
    text-align: center;
    line-height: 50px;
    margin: 0px 10px;
    font-size: 1.15em;

`
}

export default TextButton
