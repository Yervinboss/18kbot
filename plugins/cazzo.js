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

    let cm = Math.floor(Math.random() * (28 - 3 + 1)) + 3;
    let commento = '';

    if (cm < 8) commento = 'Un accendino Clipper fa più figura. 🔎';
    else if (cm < 14) commento = 'Onesto, fa il suo dovere senza pretendere premi. 🪵';
    else if (cm < 20) commento = 'Minchia zio, qua parliamo di un pezzo pesante! 🚀';
    else commento = 'ROBA DA MATTI! Un finale da porno attore, illegale! 👑🍆';

    await conn.sendMessage(jid, { react: { text: '🍆', key: m.key } });
    return await conn.sendMessage(jid, { 
        text: `🍆 *ZENO PISELLOMETRO* 🍆\n\n👤 Utente: @${targetId}\n📏 Lunghezza: *${cm} cm*\n\n📝 *Verdetto:* _${commento}_`,
        mentions: [targetId + '@s.whatsapp.net']
    }, { quoted: m });
};

handler.help = ['cazzo @tag'];
handler.tags = ['fun'];
handler.command = /^(cazzo)$/i;

export default handler;
