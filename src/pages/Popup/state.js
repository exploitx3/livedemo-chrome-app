import { atom, useRecoilState } from 'recoil'

// export const fontSizeState = atom({
//   key: "fontSizeState",
//   default: 14
// })
//
// export const fontSizeLabelState = selector({
//   key: "fontSizeLabelState",
//   get: ({get}) => {
//     const fontSize = get(fontSizeState)
//
//     return `${fontSize}px`
//   }
// })

/*
chrome.storage.local.set({key: value}, function() {
  console.log('Value is set to ' + value);
});

chrome.storage.local.get(['key'], function(result) {
  console.log('Value currently is ' + result.key);
});
 */

function setItem(key, value) {

  return localStorage.setItem(key, value)
}

function removeItem(key) {
  return localStorage.remove(key)
}

function getItemFromRecoilState(key) {
  let recoilState = {}
  try {
    recoilState = JSON.parse(localStorage.getItem('recoilState'))

  } catch(err) {
    console.log(err)
  }

  let newItem = recoilState && recoilState[key]


  return newItem
}

function getItem(key) {
  let newItem = localStorage.getItem(key)


  return newItem
}

function getItemFromStorage(key) {

  return chrome.storage.local.get(key).then(r => {
    return r[key]
  })
}

function setItemInStorage(key, value) {

  return chrome.storage.local.set({ [key]: value }).then(() => {
    return true
  })
}

const localStorageEffect = key => async ({ setSelf, onSet }) => {
  const syncValue = await getItemFromStorage(key)
  const savedValue = localStorage.getItem(key)

  console.log(`effect key ${key} - syncValue - ${syncValue} - savedValue - ${savedValue} - `)
  if (syncValue != null) {

    setSelf(syncValue)
  } else {
    if (savedValue != null) {
      setSelf(JSON.parse(savedValue))
    }

  }


  onSet((newValue, _, isReset) => {
    console.log('onSet ' + newValue)

    return isReset
      ? removeItem(key, null)
      : setItem(key, typeof newValue === 'string' ? newValue : JSON.stringify(newValue))
  })
}
export const authDataState = atom({
  key: 'authData',
  default: getItemFromRecoilState('authData'),
  // effects: [
  //   localStorageEffect('authData'),
  // ]
})

export const isRecordingState = atom({
  key: 'isRecording',
  // default: false ,
  default: getItemFromRecoilState('isRecording'),
  // effects: [
  //   localStorageEffect('isRecording'),
  // ]
})

// export const isDashboardSavingState = atom({
//   key: 'isDashboardSaving',
//   // default: false ,
//   default: getItem('isDashboardSaving'),
//   // effects: [
//   //   localStorageEffect('isDashboardSaving'),
//   // ]
// })

export const previousLocationState = atom({
  key: 'previousLocation',
  default: getItemFromRecoilState('previousLocation'),
  // effects: [
  //   localStorageEffect('previousLocation'),
  // ]
})


export const backLocationState = atom({
  key: 'backLocation',
  default: getItemFromRecoilState('backLocation'),
  // effects: [
  //   localStorageEffect('previousLocation'),
  // ]
})


export const isNameChosenState = atom({
  key: 'isNameChosen',
  default: getItemFromRecoilState('isNameChosen') === 'true',
  // effects: [
  //   localStorageEffect('isNameChosen'),
  // ]
})

export const newDemoNameState = atom({
  key: 'newDemoName',
  default: getItemFromRecoilState('newDemoName'),
  // effects: [
  //   localStorageEffect('newDemoName'),
  // ]
})

// export const newDemoShortIdState = atom({
//   key: 'newDemoShortId',
//   default: getItem('newDemoShortId'),
//   // effects: [
//   //   localStorageEffect('newDemoName'),
//   // ]
// })

export const port = atom({
  key: 'port',
  default: getItem('port'),
  // effects: [
  //   localStorageEffect('newDemoName'),
  // ]
})

export const sessionRecordingIdState = atom({
  key: 'sessionRecordingState',
  default: getItemFromRecoilState('sessionRecordingState'),
  // effects: [
  //   localStorageEffect('newDemoName'),
  // ]
})

export const userWorkspaces = atom({
  key: 'userWorkspaces',
  default: getItemFromRecoilState('userWorkspaces'),
  // effects: [
  //   localStorageEffect('userWorkspaces'),
  // ]
})

export const currentSelectedWorkspace = atom({
  key: 'currentSelectedWorkspace',
  default: getItemFromRecoilState('currentSelectedWorkspace'),
  // effects: [
  //   localStorageEffect('currentSelectedWorkspace'),
  // ]
})

export const tabInfo = atom({
  key: 'tabInfo',
  default: getItemFromRecoilState('tabInfo'),
  // effects: [
  //   localStorageEffect('currentSelectedWorkspace'),
  // ]
})

/** Last `chrome.action.getUserSettings().isOnToolbar` (synced with chrome.storage.local in popup) */
export const EXTENSION_ACTION_ON_TOOLBAR_STORAGE_KEY = 'livedemo_extension_action_on_toolbar'

export const extensionActionOnToolbarState = atom({
  key: 'extensionActionOnToolbar',
  default: null,
})

export const windowMeasures = atom({
  key: 'windowMeasures',
  default: getItemFromRecoilState('windowMeasures'),
  // effects: [
  //   localStorageEffect('currentSelectedWorkspace'),
  // ]
})

// export const fontSizeLabelState = selector({
//   key: "fontSizeLabelState",
//   get: ({get}) => {
//     const fontSize = get(fontSizeState)
//
//     return `${fontSize}px`
//   }
// })
