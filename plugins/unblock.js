const fs = require('fs');
const path = require('path');
const blacklistPath = path.join(__dirname, '../blacklist.json');

module.exports = {
    name: 'unblock',
    aliases: ['sblocca', 'unignore'],
    category: 'owner',
    description: 'Rimuove un utente dalla blacklist del bot (Solo Owner)',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;
        const ownerId = '203779773313116@lid'; 

        if (sender !== ownerId && !sender.includes('203779773313116')) {
            return sock.sendMessage(chatId, { text: '❌ Questo comando è riservato al *Creatore del Bot*.' }, { quoted: m });
        }

        let userToUnblock = null;
        if (m.message?.extendedTextMessage?.contextInfo?.participant) {
            userToUnblock = m.message.extendedTextMessage.contextInfo.participant;
        } else if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            userToUnblock = m.message.extendedTextMessage.contextInfo.mentionedJid;
        } else if (args.length > 0) {
            let rawNumber = args.join('').replace(/[^0-9]/g, '');
            if (rawNumber.length > 5) userToUnblock = `${rawNumber}@s.whatsapp.net`;
        }

        if (!userToUnblock) {
            return sock.sendMessage(chatId, { text: '⚠️ Rispondi a un utente con `.unblock` per rimuoverlo dalla lista nera.' }, { quoted: m });
        }

        try {
            let blacklist = JSON.parse(fs.readFileSync(blacklistPath, 'utf8'));
            
            if (!blacklist.includes(userToUnblock)) {
                return sock.sendMessage(chatId, { text: '⚠️ Questo utente non è presente nella lista nera del bot.' }, { quoted: m });
            }

            blacklist = blacklist.filter(id => id !== userToUnblock);
            fs.writeFileSync(blacklistPath, JSON.stringify(blacklist, null, 2));

            await sock.sendMessage(chatId, { text: `✅ L'utente è stato rimosso dalla lista nera. Il bot tornerà a rispondere ai suoi comandi.` }, { quoted: m });
        } catch (error) {
            await sock.sendMessage(chatId, { text: `❌ Errore: ${error.message}` }, { quoted: m });
        }
    }
};
