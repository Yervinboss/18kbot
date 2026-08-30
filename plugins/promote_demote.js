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
        return false;
    }
}

let handler = async (m, { conn, command }) => {
    let jid = m.key.remoteJid;
    let sender = m.key.participant || m.key.remoteJid;
    let isGroup = jid.endsWith('@g.us');

    if (!isGroup) {
        return await conn.sendMessage(jid, { text: '❌ Questo comando può essere usato solo all\'interno di un gruppo!' }, { quoted: m });
    }

    let isCmdOwner = isOwner(sender);
    let isCmdAdmin = await isAdmin(conn, jid, sender);

    if (!isCmdOwner && !isCmdAdmin) {
        return await conn.sendMessage(jid, { text: '❌ Solo i creatori del bot o gli amministratori del gruppo possono usare questo comando.' }, { quoted: m });
    }

    let who = false;
    if (m.mentionedJid && m.mentionedJid) {
        who = m.mentionedJid;
    } else if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid && m.message.extendedTextMessage.contextInfo.mentionedJid) {
        who = m.message.extendedTextMessage.contextInfo.mentionedJid;
    } else if (m.quoted && m.quoted.sender) {
        who = m.quoted.sender;
    } else if (m.message?.extendedTextMessage?.contextInfo?.participant) {
        who = m.message.extendedTextMessage.contextInfo.participant;
    }

    if (!who) {
        return await conn.sendMessage(jid, { text: `❌ *Istruzioni:* Rispondi al messaggio di un utente o taggalo per cambiare i suoi permessi!` }, { quoted: m });
    }

    let targetId = pureId(who);
    let targetJid = targetId + '@s.whatsapp.net';
    let cmd = command.toLowerCase();

    if (targetId === pureId(conn.user.id)) return await conn.sendMessage(jid, { text: '❌ Impossibile modificare i permessi del bot stesso!' }, { quoted: m });
    if (isOwner(who) && !isCmdOwner) return await conn.sendMessage(jid, { text: '❌ Non puoi togliere i permessi a un proprietario globale del bot!' }, { quoted: m });

    // 1. REAZIONE INIZIALE: Clessidra
    await conn.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    try {
        let msgText = '';

        if (cmd === 'p') {
            await conn.groupParticipantsUpdate(jid, [targetJid], 'promote');
            msgText = `⚡ @${targetId} *È DIVENTATO UN DIO!* 👑`;
        } else if (cmd === 'd') {
            await conn.groupParticipantsUpdate(jid, [targetJid], 'demote');
            msgText = `☠️ @${targetId} *È RITORNATO UN COMUNE MORTALE!* 📉`;
        }

        // 2. REAZIONE FINALE: Spunta verde sul comando
        await conn.sendMessage(jid, { react: { text: '✅', key: m.key } });

        // Invia il verdetto pulito taggando l'utente
        return await conn.sendMessage(jid, { 
            text: msgText,
            mentions: [targetJid]
        }, { quoted: m });

    } catch (e) {
        console.error('Errore modifica privilegi:', e);
        await conn.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return await conn.sendMessage(jid, { text: '❌ Errore: Assicurati che Zero Bot sia *Amministratore* del gruppo!' }, { quoted: m });
    }
};

handler.help = ['p @tag', 'd @tag'];
handler.tags = ['moderazione'];
handler.command = /^(p|d)$/i;

export default handler;
