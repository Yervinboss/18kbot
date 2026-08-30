function pureId(jid) {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
}

let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;
    let senderId = pureId(m.key.participant || m.key.remoteJid);

    // LOGICA DI CONTROLLO BLINDATA: Priorità assoluta al mittente del messaggio citato!
    let who = false;
    if (m.quoted && m.quoted.sender) {
        who = m.quoted.sender;
    } else if (m.mentionedJid && m.mentionedJid.length > 0) {
        who = m.mentionedJid;
    } else if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid && m.message.extendedTextMessage.contextInfo.mentionedJid.length > 0) {
        who = m.message.extendedTextMessage.contextInfo.mentionedJid;
    }

    let targetId = who ? pureId(who) : senderId;

    await conn.sendMessage(jid, { react: { text: '⏳', key: m.key } });
    let percentuale = Math.floor(Math.random() * 101);
    let commento = '';

    if (percentuale < 20) commento = 'Bianco latte, sbiadito. 🥚';
    else if (percentuale < 50) commento = 'Un po\' di abbronzatura da spiaggia c\'è. ☀️';
    else if (percentuale < 80) commento = 'Stile Maranza di San Siro attivo. 🎭';
    else commento = 'AFRICA SANGUE PURO! Livello Baby Gang sbloccato! 🏿👑';

    await conn.sendMessage(jid, { react: { text: '🏿', key: m.key } });
    return await conn.sendMessage(jid, { 
        text: `🏿 *ZENO NEGROMETRO* 🏿\n\n👤 Utente: @${targetId}\n📊 Tasso: *${percentuale}%*\n\n📝 *Verdetto:* _${commento}_`,
        mentions: [targetId + '@s.whatsapp.net']
    }, { quoted: m });
};

handler.help = ['negro @tag'];
handler.tags = ['fun'];
handler.command = /^(negro)$/i;

export default handler;
