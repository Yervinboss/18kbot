const fs = require('fs');
const path = require('path');
const blacklistPath = path.join(__dirname, '../blacklist.json');

module.exports = {
    name: 'block',
    aliases: ['blocca', 'ignore'],
    category: 'owner',
    description: 'Inserisce un utente nella blacklist del bot (Solo Owner)',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;
        const ownerId = '203779773313116@lid'; 

        if (sender !== ownerId && !sender.includes('203779773313116')) {
            return sock.sendMessage(chatId, { text: '❌ Questo comando è riservato al *Creatore del Bot*.' }, { quoted: m });
        }

        let userToBlock = null;
        if (m.message?.extendedTextMessage?.contextInfo?.participant) {
            userToBlock = m.message.extendedTextMessage.contextInfo.participant;
        } else if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            userToBlock = m.message.extendedTextMessage.contextInfo.mentionedJid;
        } else if (args.length > 0) {
            let rawNumber = args.join('').replace(/[^0-9]/g, '');
            if (rawNumber.length > 5) userToBlock = `${rawNumber}@s.whatsapp.net`;
        }

        if (!userToBlock) {
            return sock.sendMessage(chatId, { text: '⚠️ Rispondi a un utente con `.block` per metterlo in lista nera.' }, { quoted: m });
        }

        if (userToBlock.includes('203779773313116')) {
            return sock.sendMessage(chatId, { text: '🧠 Non puoi ignorare te stesso!' }, { quoted: m });
        }

        try {
            let blacklist = JSON.parse(fs.readFileSync(blacklistPath, 'utf8'));
            
            if (blacklist.includes(userToBlock)) {
                return sock.sendMessage(chatId, { text: '⚠️ Questo utente è già presente nella lista nera del bot.' }, { quoted: m });
            }

            blacklist.push(userToBlock);
            fs.writeFileSync(blacklistPath, JSON.stringify(blacklist, null, 2));

            await sock.sendMessage(chatId, { text: `🚫 L'utente è stato inserito nella lista nera. Il bot ora lo ignorerà completamente.` }, { quoted: m });
        } catch (error) {
            await sock.sendMessage(chatId, { text: `❌ Errore: ${error.message}` }, { quoted: m });
        }
    }
};
