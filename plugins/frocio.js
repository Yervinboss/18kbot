function pureId(jid) {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
}

let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;
    
    if (!jid.endsWith('@g.us')) {
        return await conn.sendMessage(jid, { text: '❌ Questo comando può essere usato solo nei gruppi!' }, { quoted: m });
    }

    let sender = m.key.participant || m.key.remoteJid;
    let senderId = pureId(m.key.participant || m.key.remoteJid);

    let who = null;
    if (m.mentionedJid && m.mentionedJid.length > 0) {
        who = m.mentionedJid[0];
    } else if (m.quoted && m.quoted.sender) {
        who = m.quoted.sender;
    } else if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid && 
               m.message.extendedTextMessage.contextInfo.mentionedJid.length > 0) {
        who = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
    } else {
        who = sender;
    }

    let targetId = pureId(who);
    let targetJid = targetId + '@s.whatsapp.net';

    if (pureId(sender) === targetId && (m.mentionedJid?.length > 0 || m.quoted)) {
        return await conn.sendMessage(jid, { text: '❌ Non puoi usare .frocio su te stesso! 😂' }, { quoted: m });
    }

    try {
        let groupMetadata = await conn.groupMetadata(jid);
        let exists = groupMetadata.participants.some(p => pureId(p.id) === targetId);
        if (!exists) {
            return await conn.sendMessage(jid, { 
                text: `❌ L'utente @${targetId} non è presente in questo gruppo!`, 
                mentions: [targetJid] 
            }, { quoted: m });
        }
    } catch (e) {}

    await conn.sendMessage(jid, { react: { text: '⏳', key: m.key } });
    
    let percentuale = Math.floor(Math.random() * 101);
    let commento = '';

    if (percentuale < 20) commento = 'Un etero dritto come un fuso. 🛡️';
    else if (percentuale < 50) commento = 'Qualche dubbio ce l\'ha, ma si trattiene. 👀';
    else if (percentuale < 80) commento = 'La situazione si fa sospetta stasera... 🏳️‍🌈';
    else commento = 'IL RE DELLA REGINA! Livello massimo superato! 👑🌈';

    let isTargetAdmin = false;
    try {
        let groupMetadata = await conn.groupMetadata(jid);
        let participants = groupMetadata.participants;
        isTargetAdmin = !!participants.find(p => pureId(p.id) === targetId && p.admin);
    } catch (e) {}
    
    const adminTag = isTargetAdmin ? ' 👑 *[ADMIN]*' : '';
    const isSelf = pureId(sender) === targetId;
    const selfText = isSelf ? '\n\n🤡 *Hai usato .frocio su te stesso!* 🤡' : '';

    await conn.sendMessage(jid, { react: { text: '🏳️‍🌈', key: m.key } });
    
    return await conn.sendMessage(jid, { 
        text: `🏳️‍🌈 *ZENO FROCIMETRO* 🏳️‍🌈\n\n👤 Utente: @${targetId}${adminTag}\n📊 Livello: *${percentuale}%*\n\n📝 *Verdetto:* _${commento}_${selfText}\n\n👮 *Richiesto da:* @${pureId(sender)}`,
        mentions: [targetJid, sender]
    }, { quoted: m });
};

handler.help = ['frocio @tag'];
handler.tags = ['fun'];
handler.command = /^(frocio)$/i;

export default handler;
