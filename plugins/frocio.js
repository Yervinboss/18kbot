function pureId(jid) {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
}

let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;
    let senderId = pureId(m.key.participant || m.key.remoteJid);

    // LOGICA DI CONTROLLO BLINDATA: Se c'è una risposta a un messaggio, prende al 100% il mittente di quel messaggio!
    let who = false;
    if (m.quoted && m.quoted.sender) {
        who = m.quoted.sender;
    } else if (m.mentionedJid && m.mentionedJid.length > 0) {
        who = m.mentionedJid[0];
    } else if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid && m.message.extendedTextMessage.contextInfo.mentionedJid.length > 0) {
        who = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }

    let targetId = who ? pureId(who) : senderId;

    await conn.sendMessage(jid, { react: { text: '⏳', key: m.key } });
    
    let percentuale = Math.floor(Math.random() * 101);
    let commento = '';

    if (percentuale < 20) commento = 'Un etero dritto come un fuso. 🛡️';
    else if (percentuale < 50) commento = 'Qualche dubbio ce l\'ha, ma si trattiene. 👀';
    else if (percentuale < 80) commento = 'La situazione si fa sospetta stasera... 🏳️‍🌈';
    else commento = 'IL RE DELLA REGINA! Livello massimo superato! 👑🌈';

    await conn.sendMessage(jid, { react: { text: '🏳️‍🌈', key: m.key } });
    return await conn.sendMessage(jid, { 
        text: `🏳️‍🌈 *ZENO FROCIMETRO* 🏳️‍🌈\n\n👤 Utente: @${targetId}\n📊 Livello: *${percentuale}%*\n\n📝 *Verdetto:* _${commento}_`,
        mentions: [targetId + '@s.whatsapp.net']
    }, { quoted: m });
};

handler.help = ['frocio @tag'];
handler.tags = ['fun'];
handler.command = /^(frocio)$/i;

export default handler;
