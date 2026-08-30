import { isOwner } from './owner.js';

function pureId(jid) { return jid ? jid.replace(/[^0-9]/g, '') : ''; }

async function isAdmin(conn, jid, sender) {
    try {
        let groupMetadata = await conn.groupMetadata(jid);
        let participants = groupMetadata.participants;
        let senderPure = pureId(sender);
        return !!participants.find(p => pureId(p.id) === senderPure && p.admin);
    } catch (e) { return false; }
}

let handler = async (m, { conn, command }) => {
    let jid = m.key.remoteJid;
    if (!jid.endsWith('@g.us')) {
        return await conn.sendMessage(jid, { text: '❌ Questo comando può essere lanciato solo all\'interno dei gruppi!' }, { quoted: m });
    }

    let sender = m.key.participant || m.key.remoteJid;

    // 🔒 SCUDO DI SICUREZZA: Solo i creatori del bot o gli admin del gruppo possono aprire/chiudere
    let isCmdOwner = isOwner(sender);
    let isCmdAdmin = await isAdmin(conn, jid, sender);

    if (!isCmdOwner && !isCmdAdmin) {
        return await conn.sendMessage(jid, { text: '❌ Azione negata! Solo gli amministratori della chat possono bloccare o sbloccare il gruppo.' }, { quoted: m });
    }

    let cmd = (command || '').toLowerCase().trim();

    try {
        // 🔒 COMANDO CHIUSO: Imposta il gruppo su "announcement" (Solo Admin)
        if (cmd === 'chiuso' || cmd === 'chiudi') {
            await conn.groupSettingUpdate(jid, 'announcement');
            await conn.sendMessage(jid, { react: { text: '🔒', key: m.key } });
            return await conn.sendMessage(jid, { 
                text: '🔒 *CHAT BLOCCATA CON SUCCESSO!*\n\nIl gruppo è stato chiuso dagli amministratori.\nDa questo momento *SOLO GLI ADMIN* possono inviare messaggi. Silenzio in aula! 🤫' 
            });
        }

        // 🔓 COMANDO APERTO: Imposta il gruppo su "not_announcement" (Tutti liberi)
        if (cmd === 'aperto' || cmd === 'apri') {
            await conn.groupSettingUpdate(jid, 'not_announcement');
            await conn.sendMessage(jid, { react: { text: '🔓', key: m.key } });
            return await conn.sendMessage(jid, { 
                text: '🔓 *CHAT RIAPERTA CON SUCCESSO!*\n\nLe restrizioni sono state revocate dagli amministratori.\n*TUTTI I MEMBRI* possono nuovamente inviare messaggi nel gruppo. Scatenatevi! 🎉' 
            });
        }
    } catch (err) {
        console.error('Errore modifica permessi gruppo:', err.message);
        return await conn.sendMessage(jid, { text: '❌ Errore! Assicurati che Zeno Bot sia nominato *Amministratore* del gruppo, altrimenti non ho i poteri per modificare le impostazioni della chat!' }, { quoted: m });
    }
};

handler.help = ['aperto', 'chiuso'];
handler.tags = ['moderazione'];
handler.command = /^(aperto|chiuso|apri|chiudi)$/i;

export default handler;
