// chrome.tabs.sendMessage caps at 64MiB per message. Demo payloads
// (base64 video + screenshots) routinely exceed it, so the JSON string is
// split into chunks and reassembled on the content-script side.
// Half the cap leaves headroom for the JSON envelope.
const MAX_CHUNK_CHARS = 32 * 1024 * 1024

function splitPayload(payload, chunkChars = MAX_CHUNK_CHARS) {
    if (payload.length === 0) {
        return ['']
    }

    const chunks = []
    let offset = 0

    while (offset < payload.length) {
        let end = Math.min(offset + chunkChars, payload.length)
        // Do not split a UTF-16 surrogate pair at a chunk boundary.
        if (end < payload.length) {
            const lastCode = payload.charCodeAt(end - 1)
            if (lastCode >= 0xD800 && lastCode <= 0xDBFF) {
                end++
            }
        }
        chunks.push(payload.slice(offset, end))
        offset = end
    }

    return chunks
}

// Chunks arrive in order (sender awaits each ack). Returns the full
// payload on the final chunk, null otherwise. chunkIndex 0 resets state
// so an abandoned transfer can't corrupt the next one.
function createPayloadAssembler() {
    let parts = null

    return {
        add(chunkIndex, totalChunks, chunk) {
            if (chunkIndex === 0 || !parts) {
                parts = []
            }
            parts[chunkIndex] = chunk

            if (chunkIndex !== totalChunks - 1) {
                return null
            }

            const payload = parts.join('')
            parts = null
            return payload
        }
    }
}

module.exports = {
    MAX_CHUNK_CHARS,
    splitPayload,
    createPayloadAssembler,
}
