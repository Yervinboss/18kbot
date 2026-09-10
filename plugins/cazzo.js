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
        return await conn.sendMessage(jid, { text: '❌ Non puoi usare .cazzo su te stesso! 😂' }, { quoted: m });
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

    let cm = Math.floor(Math.random() * (28 - 3 + 1)) + 3;
    let commento = '';

    if (cm < 8) commento = 'Un accendino Clipper fa più figura. 🔎';
    else if (cm < 14) commento = 'Onesto, fa il suo dovere senza pretendere premi. 🪵';
    else if (cm < 20) commento = 'Minchia zio, qua parliamo di un pezzo pesante! 🚀';
    else commento = 'ROBA DA MATTI! Un finale da porno attore, illegale! 👑🍆';

    let isTargetAdmin = false;
    try {
        let groupMetadata = await conn.groupMetadata(jid);
        let participants = groupMetadata.participants;
        isTargetAdmin = !!participants.find(p => pureId(p.id) === targetId && p.admin);
    } catch (e) {}
    
    const adminTag = isTargetAdmin ? ' 👑 *[ADMIN]*' : '';
    const isSelf = pureId(sender) === targetId;
    const selfText = isSelf ? '\n\n🤡 *Hai usato .cazzo su te stesso!* 🤡' : '';

    await conn.sendMessage(jid, { react: { text: '🍆', key: m.key } });
    
    return await conn.sendMessage(jid, { 
        text: `🍆 *ZENO PISELLOMETRO* 🍆\n\n👤 Utente: @${targetId}${adminTag}\n📏 Lunghezza: *${cm} cm*\n\n📝 *Verdetto:* _${commento}_${selfText}\n\n👮 *Richiesto da:* @${pureId(sender)}`,
        mentions: [targetJid, sender]
    }, { quoted: m });
};

handler.help = ['cazzo @tag'];
handler.tags = ['fun'];
handler.command = /^(cazzo)$/i;

export default handler;
