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

const LD_POPUP = '[LD:popup:flix]'

function logPopup(step, detail) {
    if (detail === undefined) {
        console.log(LD_POPUP, step)
        return
    }
    console.log(LD_POPUP, step, detail)
}

function logPopupError(step, err) {
    console.error(LD_POPUP, step, err && err.message ? err.message : err, err)
}

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
    // Default new demo path: DOM / html_delta recording
    const [demoMode, setDemoMode] = useState('manual')

    const DEMO_MODE_OPTIONS = [
        { value: 'manual', label: 'Screenshots + Video Recording', actionLabel: 'Start recording' },
        { value: 'dom', label: 'HTML Demo', actionLabel: 'Start recording' },
        { value: 'ai', label: 'AI Recording', actionLabel: 'Start recording' },
        { value: 'blank', label: 'Blank Demo', actionLabel: 'Create blank' },
    ]

    function startSelectedDemo() {
        if (demoMode === 'dom') {
            return startDomDeltaRecording()
        }
        if (demoMode === 'ai') {
            return startAIRecording()
        }
        if (demoMode === 'manual') {
            return startRecording()
        }
        if (demoMode === 'blank') {
            return createBlankDemo(newDemoName, currentSelectedWorkspace._id, authData.token)
                .then((newDemo) => {
                    window.open(
                        `${ENV.SERVER_URL}/workspace/${currentSelectedWorkspace._id}/storydemo/${newDemo._id}`,
                        '_blank'
                    )
                })
        }
        return null
    }

    const selectedMode = DEMO_MODE_OPTIONS.find((o) => o.value === demoMode) || DEMO_MODE_OPTIONS[0]

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

                logPopup('getTab: flix_getTabInfo response', result)

                let err = chrome.runtime.lastError
                if (err) {
                    logPopup('getTab: lastError', err.message)
                    reject(new Error(`flix_getTabInfo: ${err.message}`))
                    return
                }

                if (!(result && result.tabInfo)) {
                    logPopup('getTab: no tabInfo', result && result.error)
                    resolve(null)
                    return
                }

                setTabInfo(result.tabInfo)
                resolve(result.tabInfo)

            })

        })
    }

    useEffect(() => {
        logPopup('mount: register popup_recordingCompleted listener')

        function onRuntimeMessage(request, sender, sendResponse) {

            if (request.name === "popup_recordingCompleted") {

                logPopup('event: popup_recordingCompleted', request)

                // DOM stop from page pill never ran popup stopRecording(), so
                // clear Recoil here or the next open still thinks we're recording.
                setIsRecording(false)
                setNewDemoName('')
                setIsNameChosen(false)
                setIsSaving(false)
                chrome.action.setIcon({ path: 'logo-128.png' })

            }

            sendResponse({})
        }

        chrome.runtime.onMessage.addListener(onRuntimeMessage)
        return () => chrome.runtime.onMessage.removeListener(onRuntimeMessage)

    }, [])


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
        logPopup('mount: init checkRecording flow')
        // Background check restores DOM session from storage when SW woke cold.
        // Prefer bg truth over Recoil so a stale isRecording=true (pill stop) does
        // not force a second stop — but once bg says live, stop like Dashboard.
        checkRecording()
            .then(({ shouldStop, stopInProgress, isActive }) => {
                logPopup('mount: checkRecording result', { shouldStop, stopInProgress, isActive })
                setIsRecording(isActive)

                if (stopInProgress && !shouldStop) {
                    logPopup('mount: stop in progress — show spinner, skip duplicate stop')
                    setIsSaving(true)
                    setIsNameChosen(true)
                    return
                }

                if (shouldStop) {
                    logPopup('mount: active recording — calling stopRecording()')
                    return stopRecording()
                        .then((res) => logPopup('mount: stopRecording settled', res))
                        .catch((err) => logPopupError('mount: stopRecording failed', err))
                }

                logPopup('mount: not recording — loading tab title')
                setIsSaving(false)
                setIsNameChosen(false)
                chrome.action.setIcon({ path: 'logo-128.png' })

                return getTab()
                    .then((activeTab) => {
                        logPopup('mount: getTab ok', { tabId: activeTab && activeTab.id, title: activeTab && activeTab.title })
                        if (!activeTab) {
                            return null
                        }
                        return getWindowMeasures(activeTab.id)
                            .then((measures) => {
                                setWindowMeasures(measures)
                                return activeTab
                            })
                    })
                    .then((activeTab) => {
                        if (!activeTab) {
                            logPopup('mount: no tab behind popup — skip title')
                            return
                        }
                        logPopup('mount: set demo title from tab', activeTab.title)
                        setNewDemoName(activeTab.title)
                    })
                    .catch((err) => {
                        logPopup('mount: getTab/measures skipped', err && err.message ? err.message : err)
                    })
            })
            .catch((err) => logPopupError('mount: checkRecording flow failed', err))

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
        logPopup('checkRecording: start')

        // Only `recording === true` means a live Flix session. Leftover IsAttached /
        // helperTabId from a prior stop must not trip the spinner or auto-stop.
        return new Promise((resolve) => {
            chrome.storage.local.get(
                ['recording', 'IsAttached', 'stopInProgress', 'type', 'helperTabId'],
                (stored) => {
                    void chrome.runtime.lastError
                    const recording = stored.recording === true
                    const stopInProgress = stored.stopInProgress === true && recording
                    const shouldStop = recording && !stored.stopInProgress
                    const isActive = recording || stopInProgress

                    logPopup('checkRecording: storage', {
                        recording,
                        stopInProgress: stored.stopInProgress,
                        IsAttached: stored.IsAttached,
                        helperTabId: stored.helperTabId,
                        type: stored.type,
                        shouldStop,
                        isActive,
                    })

                    if (!recording && (stored.IsAttached || stored.helperTabId || stored.stopInProgress)) {
                        chrome.storage.local.set({
                            IsAttached: false,
                            helperTabId: 0,
                            stopInProgress: false,
                        })
                    }

                    if (shouldStop || stopInProgress) {
                        resolve({ shouldStop, stopInProgress, isActive })
                        return
                    }

                    chrome.runtime.sendMessage({ type: 'domDelta_checkRecording' }, (deltaResponse) => {
                        void chrome.runtime.lastError
                        if (deltaResponse && deltaResponse.IsAttached) {
                            logPopup('checkRecording: domDelta session active')
                            resolve({ shouldStop: true, stopInProgress: false, isActive: true })
                            return
                        }
                        resolve({ shouldStop: false, stopInProgress: false, isActive: false })
                    })
                }
            )
        })

    }

    function resolveWorkspaceIdForStop() {
        if (currentSelectedWorkspace && currentSelectedWorkspace._id) {
            return Promise.resolve(currentSelectedWorkspace._id)
        }
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['demoData', 'currentSelectedWorkspace'], (stored) => {
                void chrome.runtime.lastError
                const workspaceId = stored.demoData && stored.demoData.workspaceId
                    || stored.currentSelectedWorkspace && stored.currentSelectedWorkspace._id
                if (workspaceId) {
                    logPopup('stopRecording: workspaceId from storage', workspaceId)
                    resolve(workspaceId)
                    return
                }
                reject(new Error('stopRecording: no workspaceId in Recoil or chrome.storage'))
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

                        chrome.tabs.sendMessage(activeTab.id, {
                            type: 'takeManualRecording',
                            demoData: {
                                workspaceId: currentSelectedWorkspace._id,
                                name: newDemoName,
                                sessionRecordingId: newSessionRecordingId,
                                demoTitle: activeTab.title,
                                tabInfo: activeTab,
                                windowMeasures: localMeasures
                            },
                          }, function (response) {
              
                            window.close()
                            console.log('capture message sent')
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
                }, function (response) {

                    console.log(response)
                    window.close()
                })

            })


    }


    async function startDomDeltaRecording() {
        setIsNameChosen(true)

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
                let localMeasures = measures ? measures : (windowMeasures ? windowMeasures : {})

                chrome.runtime.sendMessage({
                    type: 'domDelta_startRecording',
                    authData: authData,
                    demoData: {
                        workspaceId: currentSelectedWorkspace._id,
                        name: newDemoName,
                        demoTitle: newDemoName || activeTab.title,
                        tabInfo: activeTab,
                        windowMeasures: localMeasures
                    },
                }, function (response) {

                    console.log(response)
                    window.close()
                })
            })
    }


    function stopRecording() {
        logPopup('stopRecording: start', {
            workspaceId: currentSelectedWorkspace && currentSelectedWorkspace._id,
            sessionRecordingId,
            newDemoName,
            hasAuth: !!(authData && authData.token),
        })

        setIsSaving(true)

        setIsNameChosen(true)

        chrome.action.setIcon({ path: 'logo-128.png' })
        setIsRecording(false)


        return new Promise((resolve, reject) => {

            // Prefer DOM-delta stop when that session is active
            logPopup('stopRecording: domDelta_checkRecording')
            chrome.runtime.sendMessage({ type: 'domDelta_checkRecording' }, (deltaCheck) => {
                const deltaErr = chrome.runtime.lastError
                if (deltaErr) {
                    logPopup('stopRecording: domDelta_check lastError', deltaErr.message)
                }
                logPopup('stopRecording: domDelta_check response', deltaCheck)

                if (deltaCheck && deltaCheck.IsAttached) {
                    logPopup('stopRecording: domDelta path')
                    chrome.runtime.sendMessage({
                        type: 'domDelta_stopRecording',
                        authData: authData,
                    }, (res) => {
                        const err = chrome.runtime.lastError
                        if (err) {
                            logPopup('stopRecording: domDelta_stop lastError', err.message)
                        }
                        logPopup('stopRecording: domDelta_stop response', res)
                        setTimeout(() => {
                            setNewDemoName('')
                            setIsNameChosen(false)
                            setIsSaving(false)
                            resolve(res)
                        }, 2000)
                    })
                    return
                }

                if (!currentSelectedWorkspace || !currentSelectedWorkspace._id) {
                    logPopup('stopRecording: Recoil workspace missing — trying storage')
                }

                resolveWorkspaceIdForStop()
                    .then((workspaceId) => {
                        logPopup('stopRecording: sending flix_stopRecording to background', { workspaceId })
                        chrome.runtime.sendMessage({
                            type: 'flix_stopRecording',
                            demoData: {
                                workspaceId: workspaceId,
                                sessionRecordingId: sessionRecordingId,
                                name: newDemoName,
                            },
                            authData: authData,
                        }, (res) => {
                            const err = chrome.runtime.lastError
                            if (err) {
                                logPopup('stopRecording: flix_stop lastError', err.message)
                            }
                            logPopup('stopRecording: flix_stopRecording ack from background', res)

                            setTimeout(() => {
                                logPopup('stopRecording: 35s wait elapsed, clearing popup state')
                                setNewDemoName('')
                                setIsNameChosen(false)
                                setIsSaving(false)
                                resolve(res)
                            }, 35000)

                        })
                    })
                    .catch((err) => {
                        setIsSaving(false)
                        logPopupError('stopRecording: abort', err)
                        reject(err)
                    })
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
                    {isSaving || isLoading ? (
                        <Spinner />
                    ) : (
                        <C.ButtonsWrapper>
                            <C.ModeBlock>
                                <C.ModeLabel htmlFor="demo-name-input">Name</C.ModeLabel>
                                <C.StyledInput
                                    id="demo-name-input"
                                    name="name-input"
                                    autoFocus
                                    disabled={isNameChosen}
                                    placeholder="Untitled"
                                    value={newDemoName}
                                    onChange={(event) => {
                                        setNewDemoName(event.target.value)
                                    }}
                                    onPressEnter={() => {
                                        if (!isRecording) {
                                            startSelectedDemo()
                                        }
                                    }}
                                />
                            </C.ModeBlock>
                            {!isRecording ? (
                                <C.ModeBlock>
                                    <C.ModeLabel htmlFor="demo-mode-select">Type</C.ModeLabel>
                                    <C.ModeSelect
                                        id="demo-mode-select"
                                        value={demoMode}
                                        onChange={(e) => setDemoMode(e.target.value)}
                                    >
                                        {DEMO_MODE_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </C.ModeSelect>
                                    <C.PrimaryAction
                                        type="button"
                                        onClick={() => startSelectedDemo()}
                                    >
                                        {demoMode === 'blank' ? (
                                            <C.PlusIcon />
                                        ) : (
                                            <C.StartRecordingIcon />
                                        )}
                                        <span>{selectedMode.actionLabel}</span>
                                    </C.PrimaryAction>
                                </C.ModeBlock>
                            ) : null}
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
        width: 100%;
        flex-grow: 1;
        justify-content: flex-start;
        align-items: stretch;
        flex-direction: column;
        gap: 16px;
        padding-top: 20px;
        box-sizing: border-box;
    `,
    ModeBlock: styled.div`
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
    `,
    ModeLabel: styled.label`
        font-size: 12px;
        font-weight: 500;
        color: ${Colors.secondaryText};
        font-family: ${Colors.fontFamily};
        text-align: left;
    `,
    ModeSelect: styled.select`
        width: 100%;
        height: 36px;
        padding: 0 10px;
        box-sizing: border-box;
        border: 1px solid ${Colors.fourthColor};
        border-radius: 4px;
        background: #fff;
        color: ${Colors.primaryText};
        font-size: 14px;
        font-family: ${Colors.fontFamily};
        outline: none;
        cursor: pointer;

        &:focus {
            border-color: ${Colors.primaryColor};
        }
    `,
    PrimaryAction: styled.button`
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        height: 40px;
        margin-top: 4px;
        border: none;
        border-radius: 4px;
        background: ${Colors.primaryColor};
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        font-family: ${Colors.fontFamily};
        cursor: pointer;

        &:hover {
            background: ${Colors.primaryColorDarker};
        }

        && .anticon {
            width: 18px;
            height: 18px;
            line-height: 1;
            display: inline-flex;
        }

        && .anticon svg {
            width: 100%;
            height: 100%;
            fill: #fff;
            color: #fff;
        }
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
            fill: currentColor;
        }
    `,
    StyledInput: styled(Input)`
        && {
            width: 100%;
            height: 36px;
            margin: 0;
            padding: 0 10px;
            box-sizing: border-box;
            border: 1px solid ${Colors.fourthColor};
            border-radius: 4px;
            background: #fff;
            color: ${Colors.primaryText};
            font-size: 14px;
            font-family: ${Colors.fontFamily};
            box-shadow: none;
        }

        &&:hover {
            border-color: ${Colors.primaryColor};
        }

        &&:focus,
        &&.ant-input:focus,
        &&.ant-input-focused {
            border-color: ${Colors.primaryColor};
            box-shadow: none;
        }

        &&:disabled {
            color: ${Colors.secondaryText};
            background: #fafafa;
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
            fill: currentColor;
        }
    `
}


export default CreateNewFlixDemo
