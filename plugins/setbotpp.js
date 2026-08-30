import fs from 'fs';
import path from 'path';
import { isOwner } from './owner.js';
import { downloadContentFromMessage } from '@realvare/baileys';

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

    // 🔒 CONTROLLO DI SICUREZZA ASSOLUTO: Solo il Creatore del bot può cambiare la faccia al bot!
    if (!isOwner(sender)) {
        return await conn.sendMessage(jid, { text: '❌ Questo comando supremo di configurazione può essere usato solo dal Creatore!' }, { quoted: m });
    }

    let quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    let targetMessage = m;

    if (quoted?.viewOnceMessage?.message) quoted = quoted.viewOnceMessage.message;
    else if (quoted?.viewOnceMessageV2?.message) quoted = quoted.viewOnceMessageV2.message;

    let imageMessage = quoted?.imageMessage || m.message?.imageMessage;

    if (!imageMessage) {
        return await conn.sendMessage(jid, { text: '📸 *ZENO AVATAR CONFIGURE*\n\n❌ Devi fare *Rispondi* a un\'immagine scrivendo \`.setbotpp\` per cambiare la mia foto profilo!' }, { quoted: m });
    }

    await conn.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    try {
        let mediaBuffer = await downloadMedia(imageMessage, 'image');
        if (!mediaBuffer) throw new Error('Download immagine fallito');

        // Aggiorna l'immagine del profilo del bot in modo nativo e centrato tramite Baileys
        await conn.updateProfilePicture(conn.user.id, mediaBuffer);

        await conn.sendMessage(jid, { react: { text: '🤖', key: m.key } });
        return await conn.sendMessage(jid, { text: '🤖 *FOTO PROFILO DEL BOT AGGIORNATA CON SUCCESSO!*\nLa mia nuova faccia è ora visibile a tutti in formato HD.' }, { quoted: m });

    } catch (e) {
        console.error('Errore nel plugin setbotpp:', e);
        await conn.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return await conn.sendMessage(jid, { text: '❌ Errore durante l\'aggiornamento della foto profilo del bot!' }, { quoted: m });
    }
};

handler.help = ['setbotpp'];
handler.tags = ['creatore'];
handler.command = /^(setbotpp|botpp|cambiafotobot)$/i;

export default handler;
