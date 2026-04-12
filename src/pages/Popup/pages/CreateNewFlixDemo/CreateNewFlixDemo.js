import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import Colors from '../../../../constants/mainColors'
import { BarsOutlined, LeftCircleOutlined, PlayCircleOutlined, PlusCircleOutlined } from '@ant-design/icons'
import IconTextButton from '../../components/IconTextButton/IconTextButton'
import Header from '../../components/Header/Header'
import Spinner from '../../components/Spinner/Spinner'
import { useNavigate } from 'react-router-dom'
import { useRecoilState, useRecoilValue } from 'recoil'
import * as state from '../../state'
import { Input } from 'antd'
import shortUUID from 'short-uuid'
import axios from '../../../../helpers/axiosInstance'
import * as ENV from '../../../../config.json'

async function getTabFromBG() {

    return new Promise(function (resolve, reject) {

        chrome.windows.getCurrent(w => {
            chrome.tabs.query({ active: true, windowId: w.id }, tabs => {


                resolve(tabs[0])
            })
        })
    })


}

const CreateNewFlixDemo = function (props) {
    let navigate = useNavigate()

    const [tabInfo, setTabInfo] = useRecoilState(state.tabInfo)

    const [backLocation, setBackLocation] = useRecoilState(state.backLocationState)

    const [authData, setAuthData] = useRecoilState(state.authDataState)
    const currentSelectedWorkspace = useRecoilValue(state.currentSelectedWorkspace)
    const [sessionRecordingId, setSessionRecordingId] = useRecoilState(state.sessionRecordingIdState)
    const [isRecording, setIsRecording] = useRecoilState(state.isRecordingState)
    const [isNameChosen, setIsNameChosen] = useRecoilState(state.isNameChosenState)
    const [newDemoName, setNewDemoName] = useRecoilState(state.newDemoNameState)
    // const [newDemoShortId, setNewDemoShortId] = useRecoilState(state.newDemoShortIdState)

    const [windowMeasures, setWindowMeasures] = useRecoilState(state.windowMeasures)

    const [isSaving, setIsSaving] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    if (!newDemoName) {
        setNewDemoName('')
    }

    if (isRecording == 'false') {
        setIsRecording(false)
    }

    if (isNameChosen == 'false') {
        setIsNameChosen(false)
    }

    function getWindowMeasures(tabId) {

        return new Promise((resolve, reject) => {

            chrome.tabs.sendMessage(tabId, {
                type: 'getWindowMeasures',
            }, function (response) {

                resolve(response)
            })
        })

    }

    async function getTab() {

        return new Promise(function (resolve, reject) {


            chrome.runtime.sendMessage({
                type: 'flix_getTabInfo',
            }, (result) => {

                console.log('flix_getTabInfo')
                console.log(result)

                let err = chrome.runtime.lastError
                if (err) {
                    console.log(err.message)
                }

                if (!(result && result.tabInfo)) {

                    reject(result)
                } else {


                    setTabInfo(result.tabInfo)
                    resolve(result.tabInfo)
                }

            })

        })
    }

    useEffect(() => {

        chrome.runtime.onMessage.addListener(
            function (request, sender, sendResponse) {

                if (request.name === "popup_recordingCompleted") {

                    console.log('popup_recordingCompleted:')
                    console.log(request)

                    if (request.storyDemo) {
                        setNewDemoName('')
                        setIsNameChosen(false)

                        setIsSaving(false)
                    }

                }

                sendResponse({})
            }
        );

    })


    function getWorkspaces(authToken) {

        return axios.get('/workspaces', {
            headers: {
                Authorization: `Bearer ${authToken}`,
            }
        })
            .then((res) => {


                return res.data
            })
    }




    function updateResources(currentSelectedWorkspace, authDataState) {

        setIsLoading(true)

        return getWorkspaces(authDataState.token)
            .then(() => {
                setIsLoading(false)
            })
            .catch(e => {
                console.log(e)
                setIsLoading(false)
                if (e.response?.status === 401) {
                    onLogout()
                }
            })
    }

    useEffect(() => {

        updateResources(currentSelectedWorkspace, authData)
    }, [])

    useEffect(() => {


        if (isRecording) {

            stopRecording()
        } else {

            setIsNameChosen(false)
            chrome.action.setIcon({ path: 'logo-128.png' })


            getTab()
                .then((activeTab) => {

                    return getWindowMeasures(activeTab.id)
                        .then((measures) => {
                            setWindowMeasures(measures)

                            return activeTab
                        })
                })
                .then((activeTab) => {


                    console.log('livedemo title set')
                    console.log(activeTab.title)
                    setNewDemoName(activeTab.title)
                })
        }

        // untillNotNull(checkRecording, 5)
        checkRecording()
            .then((isRecordingBg) => {

                console.log('isRecording - ')
                console.log(isRecordingBg)

                if (isRecordingBg !== null) {

                    setIsRecording(isRecordingBg)
                }

                // If it is recording immediately stop recording and save livedemo
                setIsRecording(isRecordingBg)
            })


        return () => {
            setIsNameChosen(false)
            setNewDemoName('')

        }
    }, [])


    function untillNotNull(funcPromise, times) {
        let finalPromise = new Promise((resolve, reject) => {
            let result = null

            let promiseChain = Promise.resolve()

            for (let i = 0; i < times; i++) {
                promiseChain = promiseChain.then(() => {
                    return funcPromise()
                        .then((res) => {

                            if (res !== null) {
                                result = res
                                throw new Error('successful')
                            }
                        })
                })
                    .then(() => {

                        return new Promise((resolveInternal, rejectInternal) => {
                            setTimeout(() => {
                                resolveInternal()
                            }, 2000)

                        })
                    })

            }

            return promiseChain
                .catch(err => {

                    resolve(result)
                })
        })


        return finalPromise
    }

    function checkRecording() {

        return new Promise((resolve, reject) => {


            chrome.runtime.sendMessage({
                type: 'flixCheckRecording',
            }, function (response) {

                let err = chrome.runtime.lastError
                if (err) {
                    console.log(err.message)
                }

                console.log('flixCheckRecording ' + JSON.stringify(response))
                resolve(response && response.IsAttached)
            })
        })

    }

    async function createBlankDemo(name, workspaceId, authToken) {

        // let newSessionRecordingId = shortUUID.generate()
        // setSessionRecordingId(newSessionRecordingId)

        // chrome.action.setIcon({ path: 'logo-recording-128.png' })
        // setIsRecording(true)

        return getTab()
            .then((activeTab) => {

                return getWindowMeasures(activeTab.id)
                    .then((measures) => {
                        setWindowMeasures(measures)

                        return { measures, activeTab }
                    })
            })
            .then(({ measures, activeTab }) => {
                console.log('activeTab')
                console.log(activeTab)

                console.log(measures)

                return axios.post(`${ENV.STORIES_API}/emptyStory`, {
                    name: name,
                    workspaceId: workspaceId,
                    tabInfo: activeTab,
                    windowMeasures: windowMeasures ? windowMeasures : {}
                }, {
                    headers: {
                        Authorization: `Bearer ${authToken}`
                    }
                })
                    .then(res => res.data)

            })


    }

    async function startRecording() {
        setIsNameChosen(true)

        let newSessionRecordingId = shortUUID.generate()
        setSessionRecordingId(newSessionRecordingId)

        chrome.action.setIcon({ path: 'logo-recording-128.png' })
        setIsRecording(true)

        return getTab()
            .then((activeTab) => {

                return getWindowMeasures(activeTab.id)
                    .then((measures) => {
                        setWindowMeasures(measures)

                        return { measures, activeTab }
                    })
            })
            .then(({ measures, activeTab }) => {
                console.log('activeTab')
                console.log(activeTab)

                chrome.tabCapture.getMediaStreamId({
                    consumerTabId: activeTab.id,
                    targetTabId: activeTab.id
                }, (streamId) => {


                    if (!streamId) {
                        console.log('couldn\'t get streamId')

                        return
                    }

                    chrome.runtime.sendMessage({
                        type: 'flix_createMediaStream',
                        tabId: activeTab.id,
                        streamId: streamId
                    }, function () {

                        // let shortId = shortUUID.generate()
                        // setNewDemoShortId(shortId)
                        // console.log('shortId set')
                        // console.log(shortId)

                        let localMeasures = measures ? measures : (windowMeasures ? windowMeasures : {})

                        console.log('flix_startRecording windowMeasures')
                        console.log(localMeasures)
                        chrome.runtime.sendMessage({
                            type: 'flix_startRecording',
                            demoData: {
                                workspaceId: currentSelectedWorkspace._id,
                                name: newDemoName,
                                sessionRecordingId: newSessionRecordingId,
                                demoTitle: activeTab.title,
                                tabInfo: activeTab,
                                windowMeasures: localMeasures
                            },
                            authData: authData
                        }, function (response) {

                            console.log(response)
                            window.close()
                        })

                    })
                })


            })
    }


    async function startAIRecording() {
        console.log('startAIRecording() function called')
        setIsNameChosen(true)

        let newSessionRecordingId = shortUUID.generate()
        setSessionRecordingId(newSessionRecordingId)

        chrome.action.setIcon({ path: 'logo-recording-128.png' })
        setIsRecording(true)

        return getTab()
            .then((activeTab) => {

                return getWindowMeasures(activeTab.id)
                    .then((measures) => {
                        setWindowMeasures(measures)

                        return { measures, activeTab }
                    })
            })
            .then(({ measures, activeTab }) => {
                console.log('activeTab')
                console.log(activeTab)


                // let shortId = shortUUID.generate()
                // setNewDemoShortId(shortId)
                // console.log('shortId set')
                // console.log(shortId)

                let localMeasures = measures ? measures : (windowMeasures ? windowMeasures : {})

                console.log('flix_startAIRecording windowMeasures')
                console.log(localMeasures)
                chrome.runtime.sendMessage({
                    type: 'flix_startAIRecording',
                    demoData: {
                        workspaceId: currentSelectedWorkspace._id,
                        name: newDemoName,
                        sessionRecordingId: newSessionRecordingId,
                        demoTitle: activeTab.title,
                        tabInfo: activeTab,
                        windowMeasures: localMeasures
                    },
                    authData: authData
                }, function (response) {

                    console.log(response)
                    window.close()
                })

            })


    }


    function stopRecording() {

        setIsSaving(true)

        setIsNameChosen(true)

        chrome.action.setIcon({ path: 'logo-128.png' })
        setIsRecording(false)


        return new Promise((resolve, reject) => {

            chrome.runtime.sendMessage({
                type: 'flix_stopRecording',
                demoData: {
                    workspaceId: currentSelectedWorkspace._id,
                    sessionRecordingId: sessionRecordingId,
                    name: newDemoName,
                },
                authData: authData,
            }, (res) => {

                // setTimeout(() => {
                //   navigate('/dashboard')
                // }, 3000)

                // let newStoryDemo = res.storyDemo
                setTimeout(() => {

                    setNewDemoName('')
                    setIsNameChosen(false)

                    setIsSaving(false)
                    // console.log('shortId final ' + demoShortId)
                    // window.open(`${ENV.SERVER_URL}/livedemos/${demoShortId}`, '_blank')

                    resolve(res)

                }, 35000)

            })

        })


    }

    function onLogout() {
        chrome.runtime.sendMessage({ type: 'unauthenticate' })
        setAuthData({})
        navigate('/login')
    }

    return (
        <C.NewDemo>
            <C.Wrapper>
                <Header />
                <C.MainContainer>
                    <C.StyledInput
                        name={'name-input'}
                        size="large"
                        autoFocus
                        disabled={isNameChosen}
                        placeholder="Untitled"
                        value={newDemoName}
                        onChange={(event) => {

                            setNewDemoName(event.target.value)
                        }}
                        onPressEnter={(e) => {
                            startRecording()
                        }}
                    />
                    {isSaving || isLoading ? (
                        <Spinner />
                    ) : (
                        <C.ButtonsWrapper>


                            {!isRecording ? (<IconTextButton
                                onClick={() => {
                                    return startAIRecording()
                                }}
                                img={<C.StartRecordingIcon />}
                                text={'AI Recording'}
                                buttonStyles={{
                                    justifyContent: 'flex-start',
                                    boxShadow: 'none',
                                    border: 'none',
                                    '&:hover': {
                                        border: 'none',
                                        color: 'green',
                                        cursor: 'pointer'
                                    },
                                    width: '100%;', fontSize: '1.2em'
                                }}
                            />) : ''}
                            {!isRecording ? (<IconTextButton
                                onClick={() => {
                                    return startRecording()
                                }}
                                img={<C.StartRecordingIcon />}
                                text={'Manual Recording'}
                                buttonStyles={{
                                    justifyContent: 'flex-start',
                                    boxShadow: 'none',
                                    border: 'none',
                                    '&:hover': {
                                        border: 'none',
                                        color: 'green',
                                        cursor: 'pointer'
                                    },
                                    width: '100%;', fontSize: '1.2em'
                                }}
                            />) : ''}
                            <IconTextButton
                                onClick={() => {

                                    return createBlankDemo(newDemoName, currentSelectedWorkspace._id, authData.token)
                                        .then((newDemo) => {

                                            debugger
                                            window.open(`${ENV.SERVER_URL}/workspace/${currentSelectedWorkspace._id}/storydemo/${newDemo._id}`, '_blank')

                                            // navigate(`/story/${newDemo._id}`)
                                        })
                                }}
                                img={<C.PlusIcon />}
                                text={'Create Blank'}
                                buttonStyles={{
                                    justifyContent: 'flex-start',
                                    boxShadow: 'none',
                                    border: 'none',
                                    '&:hover': {
                                        border: 'none',
                                        color: 'green',
                                        cursor: 'pointer'
                                    },
                                    width: '100%', fontSize: '1.2em'
                                }}
                            />
                        </C.ButtonsWrapper>
                    )
                    }

                </C.MainContainer>
                <C.FooterContainer>
                    <C.FooterWrapper>
                        <IconTextButton
                            onClick={() => {
                                navigate('/dashboard')
                            }}
                            img={<C.DashboardIcon />}
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
                                console.log('backLocation')
                                console.log(backLocation)
                                navigate((backLocation === '/new-demo' || backLocation === '/login') ? '/dashboard/livedemos' : backLocation)
                            }}
                            img={<C.BackIcon />}
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
        border-top: 1px solid rgba(0, 0, 0, .06);
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
    ButtonsWrapper: styled.div`
        display: flex;
        height: 40%;
        justify-content: space-evenly;
        align-items: center;
        flex-direction: column;
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
        border-bottom: 1px solid rgba(0, 0, 0, .06);
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
    PlusIcon: styled(PlusCircleOutlined)`
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
    `
}


export default CreateNewFlixDemo
