import React, { useEffect, useState } from 'react'
import { useRecoilState } from 'recoil'
import * as state from '../../state'
import { useNavigate } from 'react-router-dom'
import Logo from '../../../../assets/img/logo-round.svg'
import styled from 'styled-components'
import Colors from '../../../../constants/mainColors'
import axios from '../../../../helpers/axiosInstance'
import { Select } from 'antd'
import 'antd/lib/select/style/css'

let { Option } = Select

const Header = function (props) {
  let [authDataState, setAuthData] = useRecoilState(state.authDataState)
  let [userWorkspaces, setUserWorkspaces] = useRecoilState(state.userWorkspaces)
  let [currentSelectedWorkspace, setCurrentSelectedWorkspace] = useRecoilState(state.currentSelectedWorkspace)

  let [isLoading, setIsLoading] = useState(false)

  let navigate = useNavigate()

  useEffect(() => {

    
    
    if (!userWorkspaces) {
      setIsLoading(true)

      axios.get('/workspaces', {
          headers: {
            Authorization: `Bearer ${authDataState.token}`
          }
        })
        .then((res) => {
          let workspaces = res.data

          setUserWorkspaces(workspaces)

          if (workspaces.length !== 0) {

            setCurrentSelectedWorkspace(workspaces[0])
          }

          setIsLoading(false)
        })
    }

    if (userWorkspaces && !currentSelectedWorkspace) {
      setCurrentSelectedWorkspace(userWorkspaces[0])
    }


  }, [])


  return (
    <D.Wrapper>
      <D.LeftSide>
        <D.Logo src={Logo}/>
        <D.LogoText>LiveDemo</D.LogoText>
      </D.LeftSide>
      <D.RightSide>

        <D.Select
          loading={isLoading}
          dropdownStyle={{
            background: Colors.App.sidebarColor,
            boxShadow: `0 0 0 2px ${Colors.primaryColor}`
          }}
          defaultValue={
            (currentSelectedWorkspace && currentSelectedWorkspace._id) ? currentSelectedWorkspace._id : ''
          }
          value={
            (currentSelectedWorkspace && currentSelectedWorkspace._id) ? currentSelectedWorkspace._id : ''
          }
          style={{
            display: 'block',
            width: 120
          }} onChange={(selectedWorkspaceId) => {

          let selecedWorkspace = userWorkspaces.find(wk => wk._id === selectedWorkspaceId)

          setCurrentSelectedWorkspace(selecedWorkspace)

        }}>
          {userWorkspaces && userWorkspaces.map((workspace) => {
            return <Option style={{
              background: 'none',
              color: Colors.primaryColor,
              textTransform: 'capitalize'
            }} key={workspace._id} value={workspace._id}>{workspace.name}</Option>
          })
          }
        </D.Select>

      </D.RightSide>
    </D.Wrapper>
  )
}

const D = {
  Dashboard: styled.div`
    background: white;
    width: 100%;
    height: 100%;

  `,
  Wrapper: styled.div`
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
    // padding: 0 28px;

  `,
  LeftSide: styled.div`
    flex-grow: 1;
    display: flex;
  `,
  RightSide: styled.div`

  `,
  Select: styled(Select)`
    text-transform: capitalize;

    && .ant-select-selection {
      background: none;
      color: ${Colors.primaryColor};
      border: 1px solid #d9d9d9;
      box-shadow: none;
    }
    
    && .ant-select-selection:hover {
      border: 1px solid ${Colors.primaryColor};
    }
    
    && .ant-select-arrow {
      color: ${Colors.primaryColor};
    }
    
    && .ant-select-selection-selected-value {
      width: 90%;
    }
`,
  Logo: styled.img`
      && {
        width: 42px;
        height: 42px;
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
    font-size: 1em;
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
}

export default Header
