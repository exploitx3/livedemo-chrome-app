
const rrweb = require('../../custom-libs/rrweb/rrweb.umd.min.cjs')
const axios = require('axios')
const ENV = require('../../config.json')

// ENV.STORIES_API = 'https://story-api.livedemo.ai'
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function createAutoRecording(workspaceId, authToken) {
    return axios.post(`${ENV.STORIES_API}/workspaces/${workspaceId}/auto-recordings`, {}, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
        }
    })
        .then(res => res.data)
}

function completeAutoRecording(autoRecordingId, workspaceId, authToken) {
    // if(window.config.rrwebStopFn) {
    //     window.config.rrwebStopFn()
    // }

    return axios.post(`${ENV.STORIES_API}/workspaces/${workspaceId}/auto-recordings/${autoRecordingId}/complete`, {}, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
        }
    })
        .then(res => {

            return res.data
        })
}
// Usage
async function setupAutoRecording(workspaceId, authToken) {
    let eventsRef = []
    // const cursor = new StandaloneGhostCursor();
    debugger
    console.log("rrweb console log below")
    console.log(rrweb)
    let autoRecordingDoc = await createAutoRecording(workspaceId, authToken)

    // console.log(rrweb)
    let stopFn = rrweb.record({
        emit(event) {

            if (eventsRef.length > 1000) {
                // stop after 100 events
                stopFn()
            }
            // push event into the events array
            eventsRef.push(event)
        },
    })

    window.config.rrwebStopFn = stopFn

    // this function will send events to the backend and reset the events array
    function save() {
        // console.log(eventsRef.current)

        if(eventsRef && eventsRef.length !== 0) {
            axios.post(`${ENV.STORIES_API}/workspaces/${workspaceId}/auto-recordings/${autoRecordingDoc._id}/events`, {
                events: eventsRef
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            })
        }

        eventsRef = []
    }

// save events every 10 seconds
    setInterval(save, 2.5 * 1000)


    return autoRecordingDoc._id
}

export default {
    setupAutoRecording,
    completeAutoRecording
}
  