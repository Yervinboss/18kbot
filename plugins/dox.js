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

    let who = null;
    
    // 1. Se è una risposta a un messaggio
    if (m.quoted && m.quoted.sender) {
        who = m.quoted.sender;
    } 
    // 2. Se ci sono tag
    else if (m.mentionedJid && m.mentionedJid.length > 0) {
        who = m.mentionedJid[0];
    } 
    // 3. Se c'è un contesto esteso con tag
    else if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid && 
             m.message.extendedTextMessage.contextInfo.mentionedJid.length > 0) {
        who = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }
    // 4. Se non c'è né risposta né tag → bersaglio = te stesso
    else {
        who = sender;
    }

    let targetId = pureId(who);
    let targetJid = targetId + '@s.whatsapp.net';

    if (pureId(sender) === targetId && (m.mentionedJid?.length > 0 || m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0)) {
        return await conn.sendMessage(jid, { 
            text: '❌ Non puoi doxxare te stesso! 😂' 
        }, { quoted: m });
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

    await conn.sendMessage(jid, { react: { text: '📡', key: m.key } });

    let fintoIP = '192.168.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255);
    let macAddress = '00:1A:2B:3C:' + Math.floor(Math.random() * 90 + 10) + ':' + Math.floor(Math.random() * 90 + 10);

    let isTargetAdmin = false;
    try {
        let groupMetadata = await conn.groupMetadata(jid);
        let participants = groupMetadata.participants;
        isTargetAdmin = !!participants.find(p => pureId(p.id) === targetId && p.admin);
    } catch (e) {}
    
    const adminTag = isTargetAdmin ? ' 👑 *[ADMIN]*' : '';
    const isSelf = pureId(sender) === targetId;
    const selfText = isSelf ? '\n\n🤡 *Hai doxxato te stesso!* 🤡' : '';

    let doxText = `🛰️ *ZENO RADAR SECURITY ENGINE* 🛰️\n\n` +
                  `👤 *Bersaglio Intercettato:* @${targetId}${adminTag}\n` +
                  `🌐 *Indirizzo IP:* \`${fintoIP}\`\n` +
                  `🔒 *MAC Address:* \`${macAddress}\`\n` +
                  `📍 *Localizzazione:* Milano (San Siro Area)\n` +
                  `📡 *Provider:* Fastweb Backbone${selfText}\n\n` +
                  `⚠️ *NOTIFICA DI SISTEMA:* I dati più sensibili estratti da questo dispositivo sono stati crittografati e salvati nel database di Zeno Bot.\n\n` +
                  `👮 *Richiesto da:* @${pureId(sender)}`;

    return await conn.sendMessage(jid, { 
        text: doxText, 
        mentions: [targetJid, sender] 
    }, { quoted: m });
};

handler.help = ['dox @tag'];
handler.tags = ['fun'];
handler.command = /^(dox|doxxing)$/i;

export default handler;
