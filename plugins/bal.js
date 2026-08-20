const fs = require('fs');
const path = require('path');
const ecoPath = path.join(__dirname, '../economy.json');

module.exports = {
    name: 'bal',
    aliases: ['balance', 'profilo', 'wallet'],
    category: 'economy',
    description: 'Mostra il tuo portafoglio, livello, XP e profilo',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;
        const senderClean = sender.split(':')[0].split('@')[0];

        if (!fs.existsSync(ecoPath)) {
            fs.writeFileSync(ecoPath, JSON.stringify({}, null, 2));
        }
        
        let eco = JSON.parse(fs.readFileSync(ecoPath, 'utf8'));
        if (!eco[sender]) {
            eco[sender] = { coins: 500, xp: 0, level: 1, job: 'Disoccupato 🛋️' };
        }

        let user = eco[sender];
        let xpRequired = user.level * 100;
        let xpMissing = xpRequired - user.xp;

        let profileText = `📊 **PROFILO UTENTE** (@${senderClean})\n\n` +
                          `💼 Lavoro: *${user.job}*\n` +
                          `⭐ Livello: *${user.level}*\n` +
                          `✨ XP attuali: *${user.xp} / ${xpRequired}* (Mancano ${xpMissing} XP al livello successivo)\n` +
                          `💵 Portafoglio: *${user.coins} soldi*`;

        await sock.sendMessage(chatId, { text: profileText, mentions: [sender] }, { quoted: m });
    }
};

