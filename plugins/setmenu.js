import fs from 'fs';
import path from 'path';
import { downloadContentFromMessage } from '@realvare/baileys';
import { isOwner } from './owner.js';

const mediaPath = path.resolve('menu_media.json');

async function downloadMedia(mediaMessage, type) {
    let stream = await downloadContentFromMessage(mediaMessage, type);
    let buffer = Buffer.from([]);
    for await (let chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;
    let sender = m.key.participant || m.key.remoteJid;
    let senderNumber = sender.replace(/[^0-9]/g, '');

    if (!isOwner(senderNumber)) {
        return await conn.sendMessage(jid, { text: '❌ Solo il creatore del bot può usare .setmenu.' }, { quoted: m });
    }

    let quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (quoted?.viewOnceMessage?.message) quoted = quoted.viewOnceMessage.message;
    else if (quoted?.viewOnceMessageV2?.message) quoted = quoted.viewOnceMessageV2.message;
    else if (quoted?.viewOnceMessageV2Extension?.message) quoted = quoted.viewOnceMessageV2Extension.message;

    if (!quoted || (!quoted.imageMessage && !quoted.videoMessage)) {
        return await conn.sendMessage(jid, { text: '❌ Rispondi a una foto o una GIF/video con .setmenu per impostarla come immagine del menu.' }, { quoted: m });
    }

    try {
        let buffer, mime, isGif = false;

        if (quoted.videoMessage) {
            buffer = await downloadMedia(quoted.videoMessage, 'video');
            mime = quoted.videoMessage.mimetype || 'video/mp4';
            // Controlla se WhatsApp la identifica come GIF o se ha il playback GIF
            if (quoted.videoMessage.gifPlayback || mime.includes('gif')) {
                isGif = true;
            }
        } else {
            buffer = await downloadMedia(quoted.imageMessage, 'image');
            mime = quoted.imageMessage.mimetype || 'image/jpeg';
        }

        let saved = { mime, data: buffer.toString('base64'), isGif };
        fs.writeFileSync(mediaPath, JSON.stringify(saved));

        return await conn.sendMessage(jid, {
            text: `✅ Media del menu aggiornato con successo! (Modalità GIF: ${isGif ? 'Attiva 🟢' : 'No ⚪'})`
        }, { quoted: m });

    } catch (e) {
        console.error('Errore setmenu:', e);
        return await conn.sendMessage(jid, { text: '❌ Errore durante il salvataggio del media.' }, { quoted: m });
    }
};

handler.command = /^setmenu$/i;
handler.help = ['setmenu'];
handler.tags = ['owner'];

export default handler;
