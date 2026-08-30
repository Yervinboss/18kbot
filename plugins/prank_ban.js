function pureId(jid) {
    if (!jid) return '';
    return typeof jid === 'string' ? jid.replace(/[^0-9]/g, '') : String(jid).replace(/[^0-9]/g, '');
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;
    let senderId = pureId(m.key.participant || m.key.remoteJid);

    // Estrattore bersaglio blindato identico ai plugin sbloccati
    let who = false;
    if (m.message?.extendedTextMessage?.contextInfo?.participant) {
        who = m.message.extendedTextMessage.contextInfo.participant;
    } else if (m.quoted && m.quoted.sender) {
        who = m.quoted.sender;
    } else if (m.mentionedJid && m.mentionedJid.length > 0) {
        who = m.mentionedJid[0];
    }

    let targetId = who ? pureId(who) : senderId;

    if (targetId === senderId) {
        return await conn.sendMessage(jid, { text: '❌ Zio, devi taggare o rispondere a un amico per simulare il ban!' }, { quoted: m });
    }

    await conn.sendMessage(jid, { react: { text: '🔨', key: m.key } });

    // Sequenza scenografica spietata ad altissimo impatto visivo
    let msg = await conn.sendMessage(jid, { text: `🛡️ [ZENO BAN-ANTIRAID]: Rilevata violazione dei termini da parte di @${targetId}...`, mentions: [targetId + '@s.whatsapp.net'] }, { quoted: m });
    await delay(1200);

    msg = await conn.sendMessage(jid, { text: `⚙️ [SYSTEM]: Generazione pacchetto di esclusione hardware dall'infrastruttura di WhatsApp...` }, { quoted: msg });
    await delay(1500);

    let verdettoBan = `💥 *NOTIFICA DI ESPULSIONE RETE COATTIVA* 💥\n\n` +
                      `👤 *Account colpevole:* @${targetId}\n` +
                      `🛡️ *Azione:* BAN PERMANENTE\n` +
                      `⚠️ *Motivo:* Mancato rispetto del Creatore Supremo\n\n` +
                      `🔌 _Il numero è stato inserito nella blacklist globale dei server. Disconnessione forzata in corso... Bye bye! 🤫👋_`;

    return await conn.sendMessage(jid, { text: verdettoBan, mentions: [targetId + '@s.whatsapp.net'] }, { quoted: msg });
};

handler.help = ['ban @tag'];
handler.tags = ['fun'];
handler.command = /^(ban|banna|fakeban)$/i;

export default handler;
