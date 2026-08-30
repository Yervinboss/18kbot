import { downloadContentFromMessage } from '@realvare/baileys';
import { isOwner } from './owner.js';

function pureId(jid) {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
}

async function isAdmin(conn, jid, sender) {
    try {
        let groupMetadata = await conn.groupMetadata(jid);
        let participants = groupMetadata.participants;
        let senderPure = pureId(sender);
        return !!participants.find(p => pureId(p.id) === senderPure && p.admin);
    } catch (e) {
        console.log('Errore controllo admin tag:', e);
        return false;
    }
}

async function downloadMedia(mediaMessage, type) {
    let stream = await downloadContentFromMessage(mediaMessage, type);
    let buffer = Buffer.from([]);
    for await (let chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

let handler = async (m, { conn, text }) => {
    let jid = m.key.remoteJid;
    if (!jid.endsWith('@g.us')) {
        return await conn.sendMessage(jid, { text: '❌ Questo comando può essere usato solo nei gruppi!' }, { quoted: m });
    }

    let sender = m.key.participant || m.participant;
    if (!sender && m.key.fromMe) sender = conn.user.id;

    if (!isOwner(sender) && !(await isAdmin(conn, jid, sender))) {
        return await conn.sendMessage(jid, { text: '❌ Solo gli amministratori possono usare .tag.' }, { quoted: m });
    }

    let groupMetadata = await conn.groupMetadata(jid);
    let allParticipants = groupMetadata.participants.map(p => p.id);

    let quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    try {
        // CASO 1: risposta a un messaggio (testo, sticker, immagine o video)
        if (quoted) {
            if (quoted.conversation || quoted.extendedTextMessage) {
                let quotedText = quoted.conversation || quoted.extendedTextMessage.text;
                return await conn.sendMessage(jid, { text: quotedText, mentions: allParticipants });
            }

            if (quoted.stickerMessage) {
                let buffer = await downloadMedia(quoted.stickerMessage, 'sticker');
                return await conn.sendMessage(jid, { sticker: buffer, mentions: allParticipants });
            }

            if (quoted.imageMessage) {
                let buffer = await downloadMedia(quoted.imageMessage, 'image');
                return await conn.sendMessage(jid, {
                    image: buffer,
                    caption: quoted.imageMessage.caption || '',
                    mentions: allParticipants
                });
            }

            if (quoted.videoMessage) {
                let buffer = await downloadMedia(quoted.videoMessage, 'video');
                return await conn.sendMessage(jid, {
                    video: buffer,
                    caption: quoted.videoMessage.caption || '',
                    mentions: allParticipants
                });
            }

            return await conn.sendMessage(jid, { text: '❌ Tipo di messaggio non supportato per .tag.' }, { quoted: m });
        }

        // CASO 2: .tag seguito da testo diretto, es. ".tag ciao a tutti"
        if (text && text.trim()) {
            return await conn.sendMessage(jid, { text: text.trim(), mentions: allParticipants });
        }

        return await conn.sendMessage(jid, { text: '❌ Scrivi un messaggio dopo .tag, oppure rispondi a un messaggio/sticker/foto/video con .tag.' }, { quoted: m });

    } catch (e) {
        console.error('Errore comando tag:', e);
        return await conn.sendMessage(jid, { text: '❌ Errore durante l\'invio del tag.' }, { quoted: m });
    }
};

handler.command = /^tag$/i;
handler.help = ['tag'];
handler.tags = ['moderazione'];

export default handler;

