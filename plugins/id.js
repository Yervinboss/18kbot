let handler = async (m, { conn }) => {
    let chat = m.chat || m.key?.remoteJid;
    let userJid = m.sender || m.key?.participant || chat;
    let userNumber = typeof userJid === 'string' ? userJid.replace(/[^0-9]/g, '') : 'Sconosciuto';
    let isOwner = global.owner && global.owner.includes(userNumber);

    let caption = `┌──「 **INFO UTENTE** 」\n` +
                  `▢ **Numero:** +${userNumber}\n` +
                  `▢ **JID:** ${userJid}\n` +
                  `▢ **Sei il Creatore:** ${isOwner ? 'Sì 👑' : 'No ❌'}\n` +
                  `└────────────────`;

    await conn.sendMessage(chat, { text: caption });
};

handler.command = /^id|whoami$/i;
handler.tags = ['utilità'];
handler.help = ['id'];

export default handler;
