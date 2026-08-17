// Self-check for the chunked payload transfer. Run: node tools/check-chunkedPayload.js
const assert = require('assert')
const {splitPayload, createPayloadAssembler, MAX_CHUNK_CHARS} = require('../src/helpers/chunkedPayload')

// round-trip across chunk boundaries
const payload = 'x'.repeat(10) + 'y'.repeat(7)
const chunks = splitPayload(payload, 4)
assert.strictEqual(chunks.length, Math.ceil(payload.length / 4))
assert.ok(chunks.every((c) => c.length <= 4))

const assembler = createPayloadAssembler()
let result = null
chunks.forEach((chunk, i) => {
    result = assembler.add(i, chunks.length, chunk)
    if (i < chunks.length - 1) {
        assert.strictEqual(result, null)
    }
})
assert.strictEqual(result, payload)

// payload smaller than one chunk still produces one chunk
assert.deepStrictEqual(splitPayload('abc', 10), ['abc'])
const single = createPayloadAssembler()
assert.strictEqual(single.add(0, 1, 'abc'), 'abc')

// chunkIndex 0 resets an abandoned transfer
const stale = createPayloadAssembler()
stale.add(0, 3, 'stale')
assert.strictEqual(stale.add(0, 2, 'ab'), null)
assert.strictEqual(stale.add(1, 2, 'cd'), 'abcd')

// emoji must not be split mid-surrogate-pair
const emojiPayload = '😀'.repeat(5) + 'z'.repeat(8)
const emojiChunks = splitPayload(emojiPayload, 4)
const emojiAssembler = createPayloadAssembler()
let emojiResult = null
emojiChunks.forEach((chunk, i) => {
    emojiResult = emojiAssembler.add(i, emojiChunks.length, chunk)
    if (i < emojiChunks.length - 1) {
        assert.strictEqual(emojiResult, null)
    }
})
assert.strictEqual(emojiResult, emojiPayload)

// default chunk size stays under Chrome's 64MiB message cap
assert.ok(MAX_CHUNK_CHARS < 64 * 1024 * 1024)

console.log('chunkedPayload OK')
