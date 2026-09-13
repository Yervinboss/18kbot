import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isOwner } from './owner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const menuMediaPath = path.join(__dirname, '../database/menu_media.json');

function readDb() {
    if (!fs.existsSync(menuMediaPath)) return {};
    try { return JSON.parse(fs.readFileSync(menuMediaPath, 'utf8')); } catch (e) { return {}; }
}
function writeDb(data) {
    fs.mkdirSync(path.dirname(menuMediaPath), { recursive: true });
    fs.writeFileSync(menuMediaPath, JSON.stringify(data, null, 2), 'utf8');
}

// ============================================================
// 🔧 DOWNLOAD MEDIA per @realvare/baileys (Aggiornato)
// ============================================================
async function downloadMedia(m, conn) {
    let mediaMsg = null;
    let isQuoted = false;

    // Ispeziona tutte le possibili strutture di Baileys / wrapper custom
    const msgObj = m.message || m.msg || m;
    
    if (msgObj.imageMessage) mediaMsg = msgObj.imageMessage;
    else if (msgObj.videoMessage) mediaMsg = msgObj.videoMessage;
    else if (msgObj.documentMessage && (msgObj.documentMessage.mimetype || '').includes('image')) mediaMsg = msgObj.documentMessage;
    
    // Controlla se c'è un messaggio quotato (reply)
    let quotedObj = m.quoted || msgObj.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!mediaMsg && quotedObj) {
        isQuoted = true;
        const qMsg = quotedObj.message || quotedObj;
        if (qMsg.imageMessage) mediaMsg = qMsg.imageMessage;
        else if (qMsg.videoMessage) mediaMsg = qMsg.videoMessage;
        else if (quotedObj.imageMessage) mediaMsg = quotedObj.imageMessage;
        else if (quotedObj.videoMessage) mediaMsg = quotedObj.videoMessage;
    }

    // Se ancora non trovato, cerca nei contextInfo interni
    if (!mediaMsg && msgObj.extendedTextMessage?.contextInfo?.quotedMessage) {
        isQuoted = true;
        const q = msgObj.extendedTextMessage.contextInfo.quotedMessage;
        if (q.imageMessage) mediaMsg = q.imageMessage;
        else if (q.videoMessage) mediaMsg = q.videoMessage;
    }

    if (!mediaMsg) {
        console.log('[SETMENU] ⚠️ Nessun mediaMsg trovato. Struttura m:', JSON.stringify(m, null, 2).slice(0, 300));
        return null;
    }

    const type = (mediaMsg.mimetype || '').includes('video') ? 'video' : 'image';
    let buffer = null;

    // === METODO 1: downloadContentFromMessage da @realvare/baileys ===
    try {
        const baileys = await import('@realvare/baileys');
        const downloadFn = baileys.downloadContentFromMessage || baileys.default?.downloadContentFromMessage;
        if (downloadFn) {
            const stream = await downloadFn(mediaMsg, type);
            let chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            buffer = Buffer.concat(chunks);
            console.log('[SETMENU] ✅ Metodo 1 (@realvare/baileys downloadContentFromMessage) OK');
        }
    } catch (e) { console.log('[SETMENU] ❌ Metodo 1 fallito:', e.message); }

    // === METODO 2: conn.downloadMediaMessage ===
    if (!buffer) {
        try {
            if (typeof conn.downloadMediaMessage === 'function') {
                let source = isQuoted ? (m.quoted || { message: { imageMessage: mediaMsg } }) : m;
                buffer = await conn.downloadMediaMessage(source);
                console.log('[SETMENU] ✅ Metodo 2 (conn.downloadMediaMessage) OK');
            }
        } catch (e) { console.log('[SETMENU] ❌ Metodo 2 fallito:', e.message); }
    }

    // === METODO 3: m.download() o source.download() ===
    if (!buffer) {
        try {
            let source = isQuoted ? m.quoted : m;
            if (source && typeof source.download === 'function') {
                buffer = await source.download();
                console.log('[SETMENU] ✅ Metodo 3 (m.download) OK');
            }
        } catch (e) { console.log('[SETMENU] ❌ Metodo 3 fallito:', e.message); }
    }

    // === METODO 4: getFile da baileys ===
    if (!buffer) {
        try {
            const baileys = await import('@realvare/baileys');
            const getFile = baileys.getFile || baileys.default?.getFile;
            if (getFile) {
                buffer = await getFile(mediaMsg, 'buffer');
                console.log('[SETMENU] ✅ Metodo 4 (getFile) OK');
            }
        } catch (e) { console.log('[SETMENU] ❌ Metodo 4 fallito:', e.message); }
    }

    // === METODO 5: downloadMediaMessage da @whiskeysockets (fallback) ===
    if (!buffer) {
        try {
            const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
            if (downloadMediaMessage) {
                let source = isQuoted ? m.quoted : m;
                buffer = await downloadMediaMessage(source, 'buffer', {});
                console.log('[SETMENU] ✅ Metodo 5 (@whiskeysockets fallback) OK');
            }
        } catch (e) { console.log('[SETMENU] ❌ Metodo 5 fallito:', e.message); }
    }

    if (!buffer) return null;
    return { buffer, type };
}

// ============================================================
// 🎛️ HANDLER PRINCIPALE
// ============================================================
let handler = async (m, { conn, text, command }) => {
    let chatId = m.key.remoteJid;
    let sender = m.key.participant || m.key.remoteJid;

    if (!isOwner(sender)) {
        return conn.sendMessage(chatId, { text: '❌ Solo i creatori del bot possono usare questo comando.' }, { quoted: m });
    }

    // === .setmenu ===
    if (command === 'setmenu') {
        console.log('[SETMENU] Avvio download...');
        console.log('[SETMENU] Tipi messaggio:', Object.keys(m.message || {}));
        console.log('[SETMENU] Quoted presente:', !!m.quoted);

        let result = await downloadMedia(m, conn);

        if (!result) {
            return conn.sendMessage(chatId, { 
                text: `❌ *Non riesco a scaricare il media.*\n\n_Assicurati di:_\n• **Rispondere** a una foto/video con \`.setmenu\`\n\n_Controlla i log con \`pm2 logs zeno\` per dettagli._` 
            }, { quoted: m });
        }

        let { buffer: mediaBuffer, type: mediaType } = result;

        // Salva il file
        let ext = mediaType === 'video' ? 'mp4' : 'jpg';
        let fileName = `menu_custom_${Date.now()}.${ext}`;
        let filePath = path.join(__dirname, '../database', fileName);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, mediaBuffer);

        // Rimuovi il vecchio file se esiste
        let db = readDb();
        if (db.filePath && fs.existsSync(db.filePath)) {
            try { fs.unlinkSync(db.filePath); } catch (e) {}
        }

        // Salva nel DB
        db = {
            filePath: filePath,
            type: mediaType,
            updatedAt: Date.now(),
            updatedBy: sender
        };
        writeDb(db);

        await conn.sendMessage(chatId, { react: { text: '✅', key: m.key } });
        return conn.sendMessage(chatId, { 
            text: `✅ *Menu aggiornato!*\n\nOra quando qualcuno scrive \`.menu\` vedrà la tua ${mediaType === 'video' ? 'GIF/video' : 'immagine'} insieme al menu.` 
        }, { quoted: m });
    }

    // === .delmenu ===
    if (command === 'delmenu') {
        let db = readDb();
        if (db.filePath && fs.existsSync(db.filePath)) {
            try { fs.unlinkSync(db.filePath); } catch (e) {}
        }
        writeDb({});
        await conn.sendMessage(chatId, { react: { text: '🗑️', key: m.key } });
        return conn.sendMessage(chatId, { text: '🗑️ *GIF del menu rimossa.*\nTorno a usare il menu standard.' }, { quoted: m });
    }
};

handler.command = /^(setmenu|delmenu)$/i;
handler.help = ['setmenu', 'delmenu'];
handler.tags = ['owner'];
handler.owner = true;

export default handler;
