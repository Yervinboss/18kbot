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
        console.log('Errore controllo admin kick:', e);
        return false;
    }
}

let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;
    if (!jid.endsWith('@g.us')) {
        return await conn.sendMessage(jid, { text: '❌ Questo comando può essere usato solo nei gruppi!' }, { quoted: m });
    }

    let sender = m.key.participant || m.participant;
    if (!sender && m.key.fromMe) sender = conn.user.id;

    if (!isOwner(sender) && !(await isAdmin(conn, jid, sender))) {
        return await conn.sendMessage(jid, { text: '❌ Solo gli amministratori possono usare .kick.' }, { quoted: m });
    }

    let target = m.message?.extendedTextMessage?.contextInfo?.participant;
    if (!target && m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        target = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }

    if (!target) {
        return await conn.sendMessage(jid, { text: '❌ Rispondi a un messaggio dell\'utente o taggalo per rimuoverlo!' }, { quoted: m });
    }

    if (isOwner(target)) {
        return await conn.sendMessage(jid, { text: '🧠 Non puoi rimuovere il creatore del bot!' }, { quoted: m });
    }

    try {
        await conn.groupParticipantsUpdate(jid, [target], 'remove');
        await conn.sendMessage(jid, {
            text: `🚫 @${pureId(target)} è stato *rimosso dal gruppo*.`,
            mentions: [target]
        }, { quoted: m });
    } catch (e) {
        console.error('Errore kick:', e.message);
        await conn.sendMessage(jid, { text: '❌ Non sono riuscito a rimuoverlo. Controlla che io sia amministratore del gruppo.' }, { quoted: m });
    }
};

handler.command = /^kick$/i;
handler.help = ['kick'];
handler.tags = ['moderazione'];

export default handler;
