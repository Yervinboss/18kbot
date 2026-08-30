function pureId(jid) {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
}

let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;
    let senderId = pureId(m.key.participant || m.key.remoteJid);

    // FORZATURA ASSOLUTA: Isola il testo citato prima di guardare chi è il Creatore
    let who = false;
    if (m.message?.extendedTextMessage?.contextInfo?.participant) {
        who = m.message.extendedTextMessage.contextInfo.participant;
    } else if (m.quoted && m.quoted.sender) {
        who = m.quoted.sender;
    } else if (m.mentionedJid && m.mentionedJid.length > 0) {
        who = m.mentionedJid;
    } else if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid && m.message.extendedTextMessage.contextInfo.mentionedJid.length > 0) {
        who = m.message.extendedTextMessage.contextInfo.mentionedJid;
    }

    let targetId = who ? pureId(who) : senderId;

    await conn.sendMessage(jid, { react: { text: '📡', key: m.key } });

    let fintoIP = '192.168.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255);
    let macAddress = '00:1A:2B:3C:' + Math.floor(Math.random() * 90 + 10) + ':' + Math.floor(Math.random() * 90 + 10);

    let doxText = `🛰️ *ZENO RADAR SECURITY ENGINE* 🛰️\n\n` +
                  `👤 *Bersaglio Intercettato:* @${targetId}\n` +
                  `🌐 *Indirizzo IP:* \`${fintoIP}\`\n` +
                  `🔒 *MAC Address:* \`${macAddress}\`\n` +
                  `📍 *Localizzazione:* Milano (San Siro Area)\n` +
                  `📡 *Provider:* Fastweb Backbone\n\n` +
                  `⚠️ *NOTIFICA DI SISTEMA:* I dati più sensibili estratti da questo dispositivo sono stati crittografati e salvati nel database di Zeno Bot.`;

    return await conn.sendMessage(jid, { 
        text: doxText, 
        mentions: [targetId + '@s.whatsapp.net'] 
    }, { quoted: m });
};

handler.help = ['dox @tag'];
handler.tags = ['fun'];
handler.command = /^(dox|doxxing)$/i;

export default handler;
