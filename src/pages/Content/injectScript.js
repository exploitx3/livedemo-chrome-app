// console.log('Hello from injectScript')


async function onFetchResponse(resourceUrl, config) {

}

window.addListener(async (msgObj, sendCommander, sendCommandResp) => {

  if (msgObj.type === "ld.fetchRequest") {

    let response = await onFetchResponse(message);
    sendCommandResp(response)
  }

  return true

})
