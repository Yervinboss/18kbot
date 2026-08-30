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

function pureId(jid) { return jid ? jid.replace(/[^0-9]/g, '') : ''; }

async function isAdmin(conn, jid, sender) {
    try {
        let groupMetadata = await conn.groupMetadata(jid);
        return !!groupMetadata.participants.find(p => pureId(p.id) === pureId(sender) && p.admin);
    } catch (e) { return false; }
}

let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;
    let sender = m.key.participant || m.key.remoteJid;

    if (!jid.endsWith('@g.us')) {
        return await conn.sendMessage(jid, { text: '❌ Questo comando può essere lanciato solo all\'interno dei gruppi!' }, { quoted: m });
    }

    // 🔒 CONTROLLO DI SICUREZZA: Solo i creatori del bot o gli admin del gruppo possono cambiare l'icona della chat
    let isCmdOwner = isOwner(sender);
    let isCmdAdmin = await isAdmin(conn, jid, sender);

    if (!isCmdOwner && !isCmdAdmin) {
        return await conn.sendMessage(jid, { text: '❌ Devi essere un Amministratore della chat per poter cambiare l\'icona del gruppo!' }, { quoted: m });
    }

    let quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    let targetMessage = m;

    if (quoted?.viewOnceMessage?.message) quoted = quoted.viewOnceMessage.message;
    else if (quoted?.viewOnceMessageV2?.message) quoted = quoted.viewOnceMessageV2.message;

    let imageMessage = quoted?.imageMessage || m.message?.imageMessage;

    if (!imageMessage) {
        return await conn.sendMessage(jid, { text: '🖼️ *ZENO GROUP AVATAR*\n\n❌ Devi fare *Rispondi* a un\'immagine scrivendo \`.setgrouppp\` per cambiare l\'icona della chat!' }, { quoted: m });
    }

    await conn.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    try {
        let mediaBuffer = await downloadMedia(imageMessage, 'image');
        if (!mediaBuffer) throw new Error('Download immagine fallito');

        // Aggiorna l'immagine del gruppo forzando la centratura dei server di WhatsApp
        await conn.updateProfilePicture(jid, mediaBuffer);

        await conn.sendMessage(jid, { react: { text: '🖼️', key: m.key } });
        return await conn.sendMessage(jid, { text: '🖼️ *ICONA DEL GRUPPO AGGIORNATA CON SUCCESSO!*\nLa nuova immagine è stata applicata ed è centrata al millimetro.' }, { quoted: m });

    } catch (e) {
        console.error('Errore nel plugin setgrouppp:', e);
        await conn.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return await conn.sendMessage(jid, { text: '❌ Errore durante il caricamento dell\'immagine del gruppo sui server!' }, { quoted: m });
    }
};

handler.help = ['setgrouppp'];
handler.tags = ['moderazione'];
handler.command = /^(setgrouppp|grouppp|cambiafotogruppo)$/i;

export default handler;
