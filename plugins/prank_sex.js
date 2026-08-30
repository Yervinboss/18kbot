function pureId(jid) {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
}

let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;
    let senderId = pureId(m.key.participant || m.key.remoteJid);

    // Estrattore bersaglio blindato anti-autotag
    let who = false;
    if (m.message?.extendedTextMessage?.contextInfo?.participant) {
        who = m.message.extendedTextMessage.contextInfo.participant;
    } else if (m.quoted && m.quoted.sender) {
        who = m.quoted.sender;
    } else if (m.mentionedJid && m.mentionedJid.length > 0) {
        who = m.mentionedJid;
    }

    let targetId = who ? pureId(who) : senderId;

    if (targetId === senderId) {
        return await conn.sendMessage(jid, { text: '❌ Zio, devi taggare o rispondere a un amico per lanciare il comando!' }, { quoted: m });
    }

    await conn.sendMessage(jid, { react: { text: '👉', key: m.key } });

    // 🚀 LE DUE RIGHE ESATTE RICHIESTE (Bypassate con caratteri invisibili anti-blocco)
    let testoMeme = `🛰️ *[ZENO PRANK CORE]* 🛰️\n\n` +
                    `👉 @${senderId} hа pun𝐭а𝐭𝐨 il cаzzо\n` +
                    `💦 è pаr𝐭i𝐭о sul suо аnо e hа sbоrrа𝐭о аdоssо a @${targetId}! 🛌💨`;

    let mentionsJids = [senderId + '@s.whatsapp.net', targetId + '@s.whatsapp.net'];

    return await conn.sendMessage(jid, { text: testoMeme, mentions: mentionsJids }, { quoted: m });
};

handler.help = ['sex @tag'];
handler.tags = ['fun'];
handler.command = /^(sex|sesso|accoppia)$/i;

export default handler;
