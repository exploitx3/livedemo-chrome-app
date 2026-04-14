/* global chrome */

import React, { useEffect } from 'react'
import styled from 'styled-components'
import { useRecoilState } from 'recoil'
import * as state from '../../state'

async function readOnToolbar() {
  if (!chrome.action?.getUserSettings) return null
  try {
    const settings = await chrome.action.getUserSettings()
    if (typeof settings.isOnToolbar === 'boolean') return settings.isOnToolbar
  } catch (e) {
    console.log('PinReminderFooter getUserSettings', e)
  }
  return null
}

export default function PinReminderFooter() {
  const [onToolbar, setOnToolbar] = useRecoilState(state.extensionActionOnToolbarState)

  useEffect(() => {
    let cancelled = false

    async function sync() {
      const tb = await readOnToolbar()
      if (cancelled) return
      if (tb === true || tb === false) {
        setOnToolbar(tb)
      }
    }

    sync()
    return () => {
      cancelled = true
    }
  }, [setOnToolbar])

  useEffect(() => {
    if (onToolbar !== false) return undefined
    const id = window.setInterval(async () => {
      const tb = await readOnToolbar()
      if (tb === true || tb === false) {
        setOnToolbar(tb)
      }
    }, 3000)
    return () => window.clearInterval(id)
  }, [onToolbar, setOnToolbar])

  if (onToolbar !== false) return null

  return (
    <S.Footer aria-live="polite">
      <S.Message className="pinMessage">
        {'\u{1F4CC}\u00A0\u00A0'}Pin the Live Demo extension for quick access
      </S.Message>
    </S.Footer>
  )
}

const S = {
  Footer: styled.aside`
    box-sizing: border-box;
    user-select: none;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5px 8px;
    font-size: 12px;
    font-weight: 700;
    font-family: inherit;
    line-height: 1.5;
    color: hsl(243, 75%, 59%);
    text-align: center;
    background-color: hsl(243 87% 93% / 50%);
    border-top: 1px solid hsl(243 87% 93% / 80%);
  `,
  Message: styled.p`
    margin: 0;
  `,
}
