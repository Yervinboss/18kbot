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
        if (quoted) {
            let actualQuoted = quoted.viewOnceMessage?.message || quoted.viewOnceMessageV2?.message || quoted;
            
            if (actualQuoted.conversation || actualQuoted.extendedTextMessage) {
                let quotedText = actualQuoted.conversation || actualQuoted.extendedTextMessage.text;
                return await conn.sendMessage(jid, { text: quotedText, mentions: allParticipants });
            }

            if (actualQuoted.stickerMessage) {
                let buffer = await downloadMedia(actualQuoted.stickerMessage, 'sticker');
                // Per gli sticker mandiamo un messaggio di testo con le menzioni e lo sticker allegato se serve, oppure lo sticker con contextInfo
                return await conn.sendMessage(jid, { 
                    sticker: buffer, 
                    contextInfo: { mentionedJid: allParticipants } 
                });
            }

            if (actualQuoted.imageMessage) {
                let imgMsg = actualQuoted.imageMessage;
                let isViewOnce = imgMsg.viewOnce;
                let buffer = await downloadMedia(imgMsg, 'image');
                return await conn.sendMessage(jid, {
                    image: buffer,
                    caption: imgMsg.caption || '',
                    viewOnce: isViewOnce,
                    contextInfo: { mentionedJid: allParticipants }
                });
            }

            if (actualQuoted.videoMessage) {
                let vidMsg = actualQuoted.videoMessage;
                let isViewOnce = vidMsg.viewOnce;
                let buffer = await downloadMedia(vidMsg, 'video');
                return await conn.sendMessage(jid, {
                    video: buffer,
                    caption: vidMsg.caption || '',
                    viewOnce: isViewOnce,
                    contextInfo: { mentionedJid: allParticipants }
                });
            }

            if (actualQuoted.audioMessage) {
                let audioMsg = actualQuoted.audioMessage;
                let isViewOnce = audioMsg.viewOnce;
                let buffer = await downloadMedia(audioMsg, 'audio');
                return await conn.sendMessage(jid, {
                    audio: buffer,
                    mimetype: audioMsg.mimetype || 'audio/ogg; codecs=opus',
                    ptt: audioMsg.ptt || false,
                    viewOnce: isViewOnce,
                    contextInfo: { mentionedJid: allParticipants }
                });
            }

            return await conn.sendMessage(jid, { text: '❌ Tipo di messaggio non supportato per .tag.' }, { quoted: m });
        }

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
