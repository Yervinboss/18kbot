"use strict";

const { parentPort } = require('worker_threads');
const zlib = require('zlib');
const { proto } = require('../../WAProto');
const { processHistoryMessage } = require('./history');

if (parentPort) {
    parentPort.on('message', (data) => {
        try {
            const { compressedBuffer } = data;
            
            // Decompress buffer synchronously in the worker thread
            const decompressed = zlib.inflateSync(Buffer.from(compressedBuffer));
            
            // Decode protobuf in the worker thread
            const syncData = proto.HistorySync.decode(decompressed);
            
            // Process the message (constructing chats, contacts, messages arrays)
            const result = processHistoryMessage(syncData);
            
            // Post result back to main thread
            parentPort.postMessage({ status: 'success', result });
        } catch (err) {
            parentPort.postMessage({
                status: 'error',
                error: err instanceof Error ? err.stack || err.message : String(err)
            });
        }
    });
}
