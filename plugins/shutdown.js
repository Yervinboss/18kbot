import { isOwner } from './owner.js';

let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;
    let sender = m.key.participant || m.key.remoteJid;

    // 🔒 Controllo di sicurezza Owner
    if (!isOwner(sender)) {
        return await conn.sendMessage(jid, { text: '❌ Azione riservata al Creatore.' }, { quoted: m });
    }

    // Mette l'emoji del sonno come reazione al comando
    await conn.sendMessage(jid, { react: { text: '💤', key: m.key } });
    
    // Invia l'unica scritta corta richiesta
    await conn.sendMessage(jid, { 
        text: '💤 Spegnimento in corso...' 
    }, { quoted: m });

    // Stronca il server dopo un secondo e mezzo
    setTimeout(() => {
        process.exit(0);
    }, 1500);
};

handler.help = ['shutdown'];
handler.tags = ['creatore'];
handler.command = /^(shutdown|spegni|stopbot|blackout)$/i;

export default handler;
